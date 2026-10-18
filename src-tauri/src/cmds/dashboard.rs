use crate::cmds::common::*;
use crate::db::Db;
use rusqlite::{Connection, ToSql};
use serde_json::{json, Value};
use tauri::State;

// ───────────────────────── Dashboard ─────────────────────────

#[tauri::command]
pub fn dashboard(db: State<Db>, from: String, to: String) -> R<Value> {
    let c = db.0.lock().map_err(e)?;
    let p: &[&dyn ToSql] = &[&from, &to];

    let sales_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=sales.shift_id), date(sales.created_at))";
    let exp_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=expenses.shift_id), expenses.date)";
    let sal_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=salaries.shift_id), salaries.date)";
    let com_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=commissions.shift_id), commissions.date)";
    let ld_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=ld_commissions.shift_id), ld_commissions.date)";
    let voided_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=voided_sales.shift_id), (SELECT business_date FROM shifts s JOIN sales sl ON sl.shift_id=s.id WHERE sl.id=voided_sales.sale_id), date(voided_sales.voided_at))";

    let range = format!("status='completed' AND {sales_date_expr} BETWEEN ?1 AND ?2");
    let revenue = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM sales WHERE {range}"), p);
    let count = scalar(&c, &format!("SELECT COUNT(*) FROM sales WHERE {range}"), p);
    let cogs = scalar(&c, &format!("SELECT COALESCE(SUM(cost_total),0) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range})"), p);
    let voided = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM voided_sales WHERE {voided_date_expr} BETWEEN ?1 AND ?2"), p);
    let voided_n = scalar(&c, &format!("SELECT COUNT(*) FROM voided_sales WHERE {voided_date_expr} BETWEEN ?1 AND ?2"), p);
    let expenses = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE {exp_date_expr} BETWEEN ?1 AND ?2"), p);
    let salaries = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM salaries WHERE {sal_date_expr} BETWEEN ?1 AND ?2"), p);
    let commissions = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM commissions WHERE {com_date_expr} BETWEEN ?1 AND ?2"), p);
    let ld_commissions = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM ld_commissions WHERE {ld_date_expr} BETWEEN ?1 AND ?2"), p);
    let gross = revenue - cogs;
    let net = gross - expenses - salaries - commissions - ld_commissions;

    let top_employees = rows(
        &c,
        &format!(
            r#"
            SELECT employee_name,
                   ROUND(SUM(amount), 2) AS total,
                   ROUND(SUM(CASE WHEN src='salary' THEN amount ELSE 0 END), 2) AS salary,
                   ROUND(SUM(CASE WHEN src='commission' THEN amount ELSE 0 END), 2) AS commission,
                   ROUND(SUM(CASE WHEN src='ld' THEN amount ELSE 0 END), 2) AS ld_commission
            FROM (
                SELECT employee AS employee_name, amount, 'salary' AS src FROM salaries WHERE {sal_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT employee_name, amount, 'commission' AS src FROM commissions WHERE {com_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT employee_name, amount, 'ld' AS src FROM ld_commissions WHERE {ld_date_expr} BETWEEN ?1 AND ?2
            )
            WHERE employee_name != ''
            GROUP BY employee_name
            ORDER BY total DESC
            LIMIT 10
            "#
        ),
        p,
    )?;

    let daily = rows(
        &c,
        &format!(
            r#"
            SELECT day,
                   ROUND(SUM(sales), 2) AS total,
                   SUM(order_count) AS count,
                   ROUND(SUM(expenses), 2) AS expenses,
                   ROUND(SUM(salaries), 2) AS salaries,
                   ROUND(SUM(commissions), 2) AS commissions,
                   ROUND(SUM(ld_commissions), 2) AS ld_commissions,
                   ROUND(SUM(sales - expenses - salaries - commissions - ld_commissions), 2) AS net
            FROM (
                SELECT COALESCE((SELECT business_date FROM shifts WHERE id=sales.shift_id), date(sales.created_at)) AS day,
                       sales.total AS sales, 1 AS order_count, 0.0 AS expenses, 0.0 AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
                FROM sales WHERE {range}
                UNION ALL
                SELECT {exp_date_expr} AS day, 0.0 AS sales, 0 AS order_count, amount AS expenses, 0.0 AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
                FROM expenses WHERE {exp_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT {sal_date_expr} AS day, 0.0 AS sales, 0 AS order_count, 0.0 AS expenses, amount AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
                FROM salaries WHERE {sal_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT {com_date_expr} AS day, 0.0 AS sales, 0 AS order_count, 0.0 AS expenses, 0.0 AS salaries, amount AS commissions, 0.0 AS ld_commissions
                FROM commissions WHERE {com_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT {ld_date_expr} AS day, 0.0 AS sales, 0 AS order_count, 0.0 AS expenses, 0.0 AS salaries, 0.0 AS commissions, amount AS ld_commissions
                FROM ld_commissions WHERE {ld_date_expr} BETWEEN ?1 AND ?2
            )
            WHERE day IS NOT NULL AND day != ''
            GROUP BY day
            ORDER BY day ASC
            "#
        ),
        p,
    )?;

    Ok(json!({
        "revenue": r2(revenue), "orders": count, "cogs": r2(cogs), "gross_profit": r2(gross),
        "voided_total": r2(voided), "voided_count": voided_n,
        "expenses": r2(expenses), "salaries": r2(salaries),
        "commissions": r2(commissions), "ld_commissions": r2(ld_commissions),
        "net_profit": r2(net),
        "top_employees": top_employees,
        "inventory_cost": r2(scalar(&c, "SELECT COALESCE(SUM(stock*cost),0) FROM products WHERE active=1", &[])),
        "inventory_retail": r2(scalar(&c, "SELECT COALESCE(SUM(stock*price),0) FROM products WHERE active=1", &[])),
        "daily": daily,
        "top": rows(&c, &format!("SELECT name, SUM(units_per*quantity) AS units, SUM(subtotal) AS revenue FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range}) GROUP BY product_id ORDER BY revenue DESC LIMIT 8"), p)?,
        "inventory_report": rows(&c, &format!(
            r#"
            SELECT p.id,
                   p.name,
                   COALESCE(NULLIF(p.category, ''), 'General') AS category,
                   p.stock AS current_stock,
                   p.low_stock,
                   p.cost,
                   p.price,
                   COALESCE(SUM(si.quantity * si.units_per), 0) AS units_sold,
                   ROUND(COALESCE(SUM(si.subtotal), 0), 2) AS total_sold_amount
            FROM products p
            LEFT JOIN (
                SELECT product_id, quantity, units_per, subtotal
                FROM sale_items
                WHERE sale_id IN (SELECT id FROM sales WHERE {range})
            ) si ON si.product_id = p.id
            WHERE p.active = 1
            GROUP BY p.id
            ORDER BY units_sold DESC, total_sold_amount DESC, p.name ASC
            "#
        ), p)?,
        "variant_sales": rows(&c, &format!(
            r#"
            SELECT si.product_id,
                   si.variant_id,
                   COALESCE(NULLIF(si.variant_name, ''), (SELECT name FROM variants WHERE id=si.variant_id), 'Default') AS variant_name,
                   SUM(si.quantity) AS qty_sold,
                   SUM(si.quantity * si.units_per) AS units_sold,
                   ROUND(SUM(si.subtotal), 2) AS revenue
            FROM sale_items si
            WHERE si.sale_id IN (SELECT id FROM sales WHERE {range})
              AND si.variant_id IS NOT NULL
            GROUP BY si.product_id, si.variant_id, variant_name
            ORDER BY revenue DESC
            "#
        ), p)?,
        "low_stock": rows(&c, "SELECT id,name,stock,low_stock FROM products WHERE active=1 AND stock<=low_stock ORDER BY stock LIMIT 10", &[])?,
        "active_business_date": active_business_date(&c),
    }))
}

pub fn build_activity_feed(c: &Connection, from: &str, to: &str, limit: i64) -> R<Vec<Value>> {
    let p: &[&dyn ToSql] = &[&from, &to, &limit];
    rows(
        c,
        r#"
        SELECT * FROM (
            SELECT
                'audit-' || id AS uid,
                timestamp,
                actor,
                role,
                action,
                entity_type,
                entity_id,
                summary,
                details_json
            FROM audit_logs
            WHERE date(timestamp) BETWEEN ?1 AND ?2

            UNION ALL

            SELECT
                'sale-' || id AS uid,
                created_at AS timestamp,
                'Cashier' AS actor,
                'cashier' AS role,
                'SALE' AS action,
                'sale' AS entity_type,
                receipt_no AS entity_id,
                'Completed sale ' || receipt_no || ' — ₱' || printf('%.2f', total) AS summary,
                '{}' AS details_json
            FROM sales
            WHERE status='completed'
              AND COALESCE((SELECT business_date FROM shifts WHERE id=sales.shift_id), date(created_at)) BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='sale' AND a.action='SALE' AND a.entity_id=sales.receipt_no)

            UNION ALL

            SELECT
                'void-' || id AS uid,
                voided_at AS timestamp,
                CASE WHEN voided_by != '' THEN voided_by ELSE 'Administrator' END AS actor,
                'admin' AS role,
                'VOID' AS action,
                'sale' AS entity_type,
                receipt_no AS entity_id,
                'Voided receipt ' || receipt_no || ' (₱' || printf('%.2f', total) || ')' || CASE WHEN reason != '' THEN ' — ' || reason ELSE '' END AS summary,
                '{}' AS details_json
            FROM voided_sales
            WHERE COALESCE((SELECT business_date FROM shifts WHERE id=voided_sales.shift_id), (SELECT business_date FROM shifts s JOIN sales sl ON sl.shift_id=s.id WHERE sl.id=voided_sales.sale_id), date(voided_at)) BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='sale' AND a.action='VOID' AND a.entity_id=voided_sales.receipt_no)

            UNION ALL

            SELECT
                'restock-' || id AS uid,
                created_at AS timestamp,
                'Administrator' AS actor,
                'admin' AS role,
                'RESTOCK' AS action,
                'inventory' AS entity_type,
                CAST(id AS TEXT) AS entity_id,
                'Restocked ' || product_name || ' (+' || qty || ' units)' || CASE WHEN note != '' THEN ' — ' || note ELSE '' END AS summary,
                '{}' AS details_json
            FROM restocks
            WHERE COALESCE((SELECT business_date FROM shifts WHERE id=restocks.shift_id), date(created_at)) BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='inventory' AND a.action='RESTOCK' AND a.entity_id=CAST(restocks.id AS TEXT))

            UNION ALL

            SELECT
                'exp-' || id AS uid,
                date || ' 12:00:00' AS timestamp,
                'Administrator' AS actor,
                'admin' AS role,
                'EXPENSE' AS action,
                'expense' AS entity_type,
                CAST(id AS TEXT) AS entity_id,
                'Expense [' || CASE WHEN category != '' THEN category ELSE 'General' END || '] — ₱' || printf('%.2f', amount) || CASE WHEN description != '' THEN ' (' || description || ')' ELSE '' END AS summary,
                '{}' AS details_json
            FROM expenses
            WHERE COALESCE((SELECT business_date FROM shifts WHERE id=expenses.shift_id), date) BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='expense' AND a.entity_id=CAST(expenses.id AS TEXT))

            UNION ALL

            SELECT
                'sal-' || id AS uid,
                date || ' 12:00:00' AS timestamp,
                'Administrator' AS actor,
                'admin' AS role,
                'PAYROLL' AS action,
                'salary' AS entity_type,
                CAST(id AS TEXT) AS entity_id,
                'Salary paid to ' || employee || ' — ₱' || printf('%.2f', amount) || CASE WHEN note != '' THEN ' (' || note || ')' ELSE '' END AS summary,
                '{}' AS details_json
            FROM salaries
            WHERE COALESCE((SELECT business_date FROM shifts WHERE id=salaries.shift_id), date) BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='salary' AND a.entity_id=CAST(salaries.id AS TEXT))

            UNION ALL

            SELECT
                'com-' || id AS uid,
                date || ' 12:00:00' AS timestamp,
                'Administrator' AS actor,
                'admin' AS role,
                'COMMISSION' AS action,
                'commission' AS entity_type,
                CAST(id AS TEXT) AS entity_id,
                'Commission (' || type || ') paid to ' || employee_name || ' — ₱' || printf('%.2f', amount) AS summary,
                '{}' AS details_json
            FROM commissions
            WHERE COALESCE((SELECT business_date FROM shifts WHERE id=commissions.shift_id), date) BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='commission' AND a.entity_id=CAST(commissions.id AS TEXT))

            UNION ALL

            SELECT
                'ld-' || id AS uid,
                date || ' 12:00:00' AS timestamp,
                'Administrator' AS actor,
                'admin' AS role,
                'LD_COMMISSION' AS action,
                'ld_commission' AS entity_type,
                CAST(id AS TEXT) AS entity_id,
                'LD Commission paid to ' || employee_name || ' (Qty: ' || quantity || ') — ₱' || printf('%.2f', amount) AS summary,
                '{}' AS details_json
            FROM ld_commissions
            WHERE COALESCE((SELECT business_date FROM shifts WHERE id=ld_commissions.shift_id), date) BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='ld_commission' AND a.entity_id=CAST(ld_commissions.id AS TEXT))

            UNION ALL

            SELECT
                'shift-' || id AS uid,
                COALESCE(closed_at, opened_at) AS timestamp,
                CASE WHEN status='closed' AND closed_by != '' THEN closed_by WHEN opened_by != '' THEN opened_by ELSE 'Cashier' END AS actor,
                'cashier' AS role,
                CASE WHEN status='closed' THEN 'SHIFT_CLOSE' ELSE 'SHIFT_OPEN' END AS action,
                'shift' AS entity_type,
                CAST(id AS TEXT) AS entity_id,
                CASE WHEN status='closed'
                     THEN 'Closed Shift #' || id || ' (' || business_date || ') — Closing Cash: ₱' || printf('%.2f', closing_cash)
                     ELSE 'Opened Shift #' || id || ' (' || business_date || ') — Opening Float: ₱' || printf('%.2f', opening_cash)
                END AS summary,
                '{}' AS details_json
            FROM shifts
            WHERE COALESCE(business_date, date(opened_at)) BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='shift' AND a.entity_id=CAST(shifts.id AS TEXT))
        )
        ORDER BY timestamp DESC
        LIMIT ?3
        "#,
        p,
    )
}

#[tauri::command]
pub fn admin_dashboard(db: State<Db>, from: String, to: String) -> R<Value> {
    let c = db.0.lock().map_err(e)?;
    let p: &[&dyn ToSql] = &[&from, &to];

    let sales_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=sales.shift_id), date(sales.created_at))";
    let exp_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=expenses.shift_id), expenses.date)";
    let sal_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=salaries.shift_id), salaries.date)";
    let com_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=commissions.shift_id), commissions.date)";
    let ld_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=ld_commissions.shift_id), ld_commissions.date)";
    let voided_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=voided_sales.shift_id), (SELECT business_date FROM shifts s JOIN sales sl ON sl.shift_id=s.id WHERE sl.id=voided_sales.sale_id), date(voided_sales.voided_at))";
    let restock_date_expr = "COALESCE((SELECT business_date FROM shifts WHERE id=restocks.shift_id), date(restocks.created_at))";
    let shift_date_expr = "COALESCE(shifts.business_date, date(shifts.opened_at))";

    let range = format!("status='completed' AND {sales_date_expr} BETWEEN ?1 AND ?2");

    let revenue = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM sales WHERE {range}"), p);
    let count = scalar(&c, &format!("SELECT COUNT(*) FROM sales WHERE {range}"), p);
    let cogs = scalar(&c, &format!("SELECT COALESCE(SUM(cost_total),0) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range})"), p);
    let voided = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM voided_sales WHERE {voided_date_expr} BETWEEN ?1 AND ?2"), p);
    let voided_n = scalar(&c, &format!("SELECT COUNT(*) FROM voided_sales WHERE {voided_date_expr} BETWEEN ?1 AND ?2"), p);
    let expenses = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE {exp_date_expr} BETWEEN ?1 AND ?2"), p);
    let salaries = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM salaries WHERE {sal_date_expr} BETWEEN ?1 AND ?2"), p);
    let commissions = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM commissions WHERE {com_date_expr} BETWEEN ?1 AND ?2"), p);
    let ld_commissions = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM ld_commissions WHERE {ld_date_expr} BETWEEN ?1 AND ?2"), p);

    let gross = revenue - cogs;
    let total_overheads = expenses + salaries + commissions + ld_commissions;
    let net = gross - total_overheads;
    let gross_margin = if revenue > 0.0 { r2((gross / revenue) * 100.0) } else { 0.0 };
    let net_margin = if revenue > 0.0 { r2((net / revenue) * 100.0) } else { 0.0 };
    let avg_ticket = if count > 0.0 { r2(revenue / count) } else { 0.0 };
    let void_rate = if (revenue + voided) > 0.0 { r2((voided / (revenue + voided)) * 100.0) } else { 0.0 };

    let inv_cost = scalar(&c, "SELECT COALESCE(SUM(stock*cost),0) FROM products WHERE active=1", &[]);
    let inv_retail = scalar(&c, "SELECT COALESCE(SUM(stock*price),0) FROM products WHERE active=1", &[]);

    // ── Previous Period Comparison ──
    let from_parsed = chrono::NaiveDate::parse_from_str(&from, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Local::now().date_naive());
    let to_parsed = chrono::NaiveDate::parse_from_str(&to, "%Y-%m-%d")
        .unwrap_or(from_parsed);
    let span_days = (to_parsed - from_parsed).num_days().max(0) + 1;
    let prev_to_date = from_parsed - chrono::Duration::days(1);
    let prev_from_date = prev_to_date - chrono::Duration::days(span_days - 1);
    let prev_from = prev_from_date.format("%Y-%m-%d").to_string();
    let prev_to = prev_to_date.format("%Y-%m-%d").to_string();
    let pp: &[&dyn ToSql] = &[&prev_from, &prev_to];

    let prev_revenue = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM sales WHERE {range}"), pp);
    let prev_count = scalar(&c, &format!("SELECT COUNT(*) FROM sales WHERE {range}"), pp);
    let prev_cogs = scalar(&c, &format!("SELECT COALESCE(SUM(cost_total),0) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range})"), pp);
    let prev_voided = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM voided_sales WHERE {voided_date_expr} BETWEEN ?1 AND ?2"), pp);
    let prev_voided_n = scalar(&c, &format!("SELECT COUNT(*) FROM voided_sales WHERE {voided_date_expr} BETWEEN ?1 AND ?2"), pp);
    let prev_expenses = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE {exp_date_expr} BETWEEN ?1 AND ?2"), pp);
    let prev_salaries = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM salaries WHERE {sal_date_expr} BETWEEN ?1 AND ?2"), pp);
    let prev_commissions = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM commissions WHERE {com_date_expr} BETWEEN ?1 AND ?2"), pp);
    let prev_ld_commissions = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM ld_commissions WHERE {ld_date_expr} BETWEEN ?1 AND ?2"), pp);
    let prev_gross = prev_revenue - prev_cogs;
    let prev_overheads = prev_expenses + prev_salaries + prev_commissions + prev_ld_commissions;
    let prev_net = prev_gross - prev_overheads;
    let prev_avg_ticket = if prev_count > 0.0 { r2(prev_revenue / prev_count) } else { 0.0 };
    let prev_void_rate = if (prev_revenue + prev_voided) > 0.0 {
        r2((prev_voided / (prev_revenue + prev_voided)) * 100.0)
    } else {
        0.0
    };

    let prev_daily = rows(
        &c,
        &format!(
            r#"
            SELECT day,
                   ROUND(SUM(sales), 2) AS sales,
                   SUM(order_count) AS count,
                   ROUND(SUM(expenses + salaries + commissions + ld_commissions), 2) AS overheads,
                   ROUND(SUM(sales - expenses - salaries - commissions - ld_commissions), 2) AS net
            FROM (
                SELECT COALESCE((SELECT business_date FROM shifts WHERE id=sales.shift_id), date(sales.created_at)) AS day,
                       sales.total AS sales, 1 AS order_count, 0.0 AS expenses, 0.0 AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
                FROM sales WHERE {range}
                UNION ALL
                SELECT {exp_date_expr} AS day, 0.0 AS sales, 0 AS order_count, amount AS expenses, 0.0 AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
                FROM expenses WHERE {exp_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT {sal_date_expr} AS day, 0.0 AS sales, 0 AS order_count, 0.0 AS expenses, amount AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
                FROM salaries WHERE {sal_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT {com_date_expr} AS day, 0.0 AS sales, 0 AS order_count, 0.0 AS expenses, 0.0 AS salaries, amount AS commissions, 0.0 AS ld_commissions
                FROM commissions WHERE {com_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT {ld_date_expr} AS day, 0.0 AS sales, 0 AS order_count, 0.0 AS expenses, 0.0 AS salaries, 0.0 AS commissions, amount AS ld_commissions
                FROM ld_commissions WHERE {ld_date_expr} BETWEEN ?1 AND ?2
            )
            WHERE day IS NOT NULL AND day != ''
            GROUP BY day
            ORDER BY day ASC
            "#
        ),
        pp,
    )?;

    // ── Today & Month-to-Date (MTD) Snapshot anchored to Shift Date ──
    let today_date = active_business_date(&c);
    let tp: &[&dyn ToSql] = &[&today_date, &today_date];
    let today_rev = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM sales WHERE {range}"), tp);
    let today_ord = scalar(&c, &format!("SELECT COUNT(*) FROM sales WHERE {range}"), tp);
    let today_cogs = scalar(&c, &format!("SELECT COALESCE(SUM(cost_total),0) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range})"), tp);
    let today_exp = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE {exp_date_expr} BETWEEN ?1 AND ?2"), tp);
    let today_sal = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM salaries WHERE {sal_date_expr} BETWEEN ?1 AND ?2"), tp);
    let today_com = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM commissions WHERE {com_date_expr} BETWEEN ?1 AND ?2"), tp);
    let today_ld = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM ld_commissions WHERE {ld_date_expr} BETWEEN ?1 AND ?2"), tp);
    let today_net = (today_rev - today_cogs) - (today_exp + today_sal + today_com + today_ld);
    let today_records = scalar(
        &c,
        &format!(
            r#"
            SELECT
                (SELECT COUNT(*) FROM sales WHERE {sales_date_expr}=?1) +
                (SELECT COUNT(*) FROM expenses WHERE {exp_date_expr}=?1) +
                (SELECT COUNT(*) FROM salaries WHERE {sal_date_expr}=?1) +
                (SELECT COUNT(*) FROM commissions WHERE {com_date_expr}=?1) +
                (SELECT COUNT(*) FROM ld_commissions WHERE {ld_date_expr}=?1) +
                (SELECT COUNT(*) FROM restocks WHERE {restock_date_expr}=?1)
            "#
        ),
        &[&today_date],
    );

    let bdate_parsed = chrono::NaiveDate::parse_from_str(&today_date, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Local::now().date_naive());
    let mtd_from = format!("{}-{:02}-01", bdate_parsed.format("%Y"), bdate_parsed.format("%m"));
    let mtd_to = today_date.clone();
    let mp: &[&dyn ToSql] = &[&mtd_from, &mtd_to];
    let mtd_rev = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM sales WHERE {range}"), mp);
    let mtd_ord = scalar(&c, &format!("SELECT COUNT(*) FROM sales WHERE {range}"), mp);
    let mtd_cogs = scalar(&c, &format!("SELECT COALESCE(SUM(cost_total),0) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range})"), mp);
    let mtd_exp = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE {exp_date_expr} BETWEEN ?1 AND ?2"), mp);
    let mtd_sal = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM salaries WHERE {sal_date_expr} BETWEEN ?1 AND ?2"), mp);
    let mtd_com = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM commissions WHERE {com_date_expr} BETWEEN ?1 AND ?2"), mp);
    let mtd_ld = scalar(&c, &format!("SELECT COALESCE(SUM(amount),0) FROM ld_commissions WHERE {ld_date_expr} BETWEEN ?1 AND ?2"), mp);
    let mtd_gross = mtd_rev - mtd_cogs;
    let mtd_ovh = mtd_exp + mtd_sal + mtd_com + mtd_ld;
    let mtd_net = mtd_gross - mtd_ovh;

    // ── Record & Entity Counts ──
    let products_active = scalar(&c, "SELECT COUNT(*) FROM products WHERE active=1", &[]) as i64;
    let products_out_of_stock = scalar(&c, "SELECT COUNT(*) FROM products WHERE active=1 AND stock<=0", &[]) as i64;
    let products_low_stock = scalar(&c, "SELECT COUNT(*) FROM products WHERE active=1 AND stock>0 AND stock<=low_stock", &[]) as i64;
    let products_healthy = (products_active - products_out_of_stock - products_low_stock).max(0);
    let employees_active = scalar(&c, "SELECT COUNT(*) FROM employees WHERE active=1", &[]) as i64;
    let cashiers_count = scalar(&c, "SELECT COUNT(*) FROM cashiers", &[]) as i64;
    let open_shifts_count = scalar(&c, "SELECT COUNT(*) FROM shifts WHERE status='open'", &[]) as i64;

    let expenses_count = scalar(&c, &format!("SELECT COUNT(*) FROM expenses WHERE {exp_date_expr} BETWEEN ?1 AND ?2"), p) as i64;
    let salaries_count = scalar(&c, &format!("SELECT COUNT(*) FROM salaries WHERE {sal_date_expr} BETWEEN ?1 AND ?2"), p) as i64;
    let commissions_count = scalar(&c, &format!("SELECT COUNT(*) FROM commissions WHERE {com_date_expr} BETWEEN ?1 AND ?2"), p) as i64;
    let ld_commissions_count = scalar(&c, &format!("SELECT COUNT(*) FROM ld_commissions WHERE {ld_date_expr} BETWEEN ?1 AND ?2"), p) as i64;
    let restocks_count = scalar(&c, &format!("SELECT COUNT(*) FROM restocks WHERE {restock_date_expr} BETWEEN ?1 AND ?2"), p) as i64;
    let shifts_count = scalar(&c, &format!("SELECT COUNT(*) FROM shifts WHERE {shift_date_expr} BETWEEN ?1 AND ?2"), p) as i64;
    let total_records = (count as i64) + (voided_n as i64) + expenses_count + salaries_count + commissions_count + ld_commissions_count + restocks_count;

    // Hourly sales volume (correctly includes transactions past midnight that belong to the shift)
    let hourly = rows(
        &c,
        &format!(
            "SELECT strftime('%H', created_at) AS hour, COUNT(*) AS count, ROUND(SUM(total), 2) AS revenue FROM sales WHERE {range} GROUP BY hour ORDER BY hour"
        ),
        p,
    )?;

    // Sales by Category
    let categories = rows(
        &c,
        &format!(
            r#"
            SELECT COALESCE(NULLIF(p.category, ''), 'General') AS category,
                   ROUND(SUM(si.subtotal), 2) AS revenue,
                   SUM(si.quantity * si.units_per) AS units,
                   ROUND(SUM(si.subtotal - si.cost_total), 2) AS gross_profit
            FROM sale_items si
            LEFT JOIN products p ON si.product_id = p.id
            WHERE si.sale_id IN (SELECT id FROM sales WHERE {range})
            GROUP BY category
            ORDER BY revenue DESC
            "#
        ),
        p,
    )?;

    // Product Profitability & Performance Table (products with sales in period)
    let product_performance = rows(
        &c,
        &format!(
            r#"
            SELECT p.id,
                   p.name,
                   p.barcode,
                   COALESCE(NULLIF(p.category, ''), 'General') AS category,
                   p.stock AS current_stock,
                   p.low_stock,
                   p.cost AS unit_cost,
                   p.price AS unit_price,
                   SUM(si.quantity * si.units_per) AS units_sold,
                   ROUND(SUM(si.subtotal), 2) AS revenue,
                   ROUND(SUM(si.cost_total), 2) AS cogs,
                   ROUND(SUM(si.subtotal - si.cost_total), 2) AS gross_profit,
                   ROUND(CASE WHEN SUM(si.subtotal) > 0 THEN ((SUM(si.subtotal - si.cost_total) / SUM(si.subtotal)) * 100) ELSE 0 END, 1) AS margin_pct
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id IN (SELECT id FROM sales WHERE {range})
            GROUP BY p.id
            ORDER BY revenue DESC
            "#
        ),
        p,
    )?;

    // Full Catalog Performance (includes active products even with 0 sales in period)
    let catalog_performance = rows(
        &c,
        &format!(
            r#"
            SELECT p.id,
                   p.name,
                   p.barcode,
                   COALESCE(NULLIF(p.category, ''), 'General') AS category,
                   p.stock AS current_stock,
                   p.low_stock,
                   p.cost AS unit_cost,
                   p.price AS unit_price,
                   p.image,
                   COALESCE(SUM(si.quantity * si.units_per), 0) AS units_sold,
                   ROUND(COALESCE(SUM(si.subtotal), 0), 2) AS revenue,
                   ROUND(COALESCE(SUM(si.cost_total), 0), 2) AS cogs,
                   ROUND(COALESCE(SUM(si.subtotal - si.cost_total), 0), 2) AS gross_profit,
                   ROUND(CASE
                       WHEN COALESCE(SUM(si.subtotal), 0) > 0 THEN ((SUM(si.subtotal - si.cost_total) / SUM(si.subtotal)) * 100)
                       WHEN p.price > 0 THEN (((p.price - p.cost) / p.price) * 100)
                       ELSE 0
                   END, 1) AS margin_pct
            FROM products p
            LEFT JOIN (
                SELECT product_id, quantity, units_per, subtotal, cost_total
                FROM sale_items
                WHERE sale_id IN (SELECT id FROM sales WHERE {range})
            ) si ON si.product_id = p.id
            WHERE p.active = 1
            GROUP BY p.id
            ORDER BY revenue DESC, p.name COLLATE NOCASE ASC
            "#
        ),
        p,
    )?;

    // Variant sales in period
    let variant_sales = rows(
        &c,
        &format!(
            r#"
            SELECT si.product_id,
                   si.variant_id,
                   COALESCE(NULLIF(si.variant_name, ''), (SELECT name FROM variants WHERE id=si.variant_id), 'Default') AS variant_name,
                   SUM(si.quantity) AS qty_sold,
                   SUM(si.quantity * si.units_per) AS units_sold,
                   ROUND(SUM(si.subtotal), 2) AS revenue
            FROM sale_items si
            WHERE si.sale_id IN (SELECT id FROM sales WHERE {range})
              AND si.variant_id IS NOT NULL
            GROUP BY si.product_id, si.variant_id, variant_name
            ORDER BY revenue DESC
            "#
        ),
        p,
    )?;

    // Low stock & Out of stock items
    let low_stock_items = rows(
        &c,
        "SELECT id, name, COALESCE(NULLIF(category, ''), 'General') AS category, stock, low_stock, cost, price FROM products WHERE active=1 AND stock <= low_stock ORDER BY stock ASC, name COLLATE NOCASE ASC",
        &[],
    )?;

    // Expense breakdown by category
    let expense_categories = rows(
        &c,
        &format!(
            "SELECT COALESCE(NULLIF(category, ''), 'General') AS category, ROUND(SUM(amount), 2) AS total, COUNT(*) AS count FROM expenses WHERE {exp_date_expr} BETWEEN ?1 AND ?2 GROUP BY COALESCE(NULLIF(category, ''), 'General') ORDER BY total DESC"
        ),
        p,
    )?;

    // Top performing employees
    let top_employees = rows(
        &c,
        &format!(
            r#"
            SELECT employee_name,
                   ROUND(SUM(amount), 2) AS total,
                   ROUND(SUM(CASE WHEN src='salary' THEN amount ELSE 0 END), 2) AS salary,
                   ROUND(SUM(CASE WHEN src='commission' THEN amount ELSE 0 END), 2) AS commission,
                   ROUND(SUM(CASE WHEN src='ld' THEN amount ELSE 0 END), 2) AS ld_commission,
                   COUNT(*) AS payout_count
            FROM (
                SELECT employee AS employee_name, amount, 'salary' AS src FROM salaries WHERE {sal_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT employee_name, amount, 'commission' AS src FROM commissions WHERE {com_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT employee_name, amount, 'ld' AS src FROM ld_commissions WHERE {ld_date_expr} BETWEEN ?1 AND ?2
            )
            WHERE employee_name != ''
            GROUP BY employee_name
            ORDER BY total DESC
            LIMIT 15
            "#
        ),
        p,
    )?;

    // Shift audit history
    let shift_history = rows(
        &c,
        &format!(
            "SELECT * FROM shifts WHERE {shift_date_expr} BETWEEN ?1 AND ?2 ORDER BY id DESC LIMIT 100"
        ),
        p,
    )?;

    // Daily sales vs overheads trend (includes cogs and gross_profit per day)
    let daily = rows(
        &c,
        &format!(
            r#"
            SELECT day,
                   day AS date,
                   ROUND(SUM(sales), 2) AS sales,
                   ROUND(SUM(sales), 2) AS total,
                   ROUND(SUM(cogs), 2) AS cogs,
                   ROUND(SUM(sales - cogs), 2) AS gross_profit,
                   SUM(order_count) AS count,
                   ROUND(SUM(expenses), 2) AS expenses,
                   ROUND(SUM(salaries), 2) AS salaries,
                   ROUND(SUM(commissions), 2) AS commissions,
                   ROUND(SUM(ld_commissions), 2) AS ld_commissions,
                   ROUND(SUM(sales - cogs - expenses - salaries - commissions - ld_commissions), 2) AS net_after_cogs,
                   ROUND(SUM(sales - expenses - salaries - commissions - ld_commissions), 2) AS net
            FROM (
                SELECT COALESCE((SELECT business_date FROM shifts WHERE id=sales.shift_id), date(sales.created_at)) AS day,
                       sales.total AS sales,
                       COALESCE((SELECT SUM(si.cost_total) FROM sale_items si WHERE si.sale_id = sales.id), 0.0) AS cogs,
                       1 AS order_count,
                       0.0 AS expenses,
                       0.0 AS salaries,
                       0.0 AS commissions,
                       0.0 AS ld_commissions
                FROM sales WHERE {range}
                UNION ALL
                SELECT {exp_date_expr} AS day, 0.0 AS sales, 0.0 AS cogs, 0 AS order_count, amount AS expenses, 0.0 AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
                FROM expenses WHERE {exp_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT {sal_date_expr} AS day, 0.0 AS sales, 0.0 AS cogs, 0 AS order_count, 0.0 AS expenses, amount AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
                FROM salaries WHERE {sal_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT {com_date_expr} AS day, 0.0 AS sales, 0.0 AS cogs, 0 AS order_count, 0.0 AS expenses, 0.0 AS salaries, amount AS commissions, 0.0 AS ld_commissions
                FROM commissions WHERE {com_date_expr} BETWEEN ?1 AND ?2
                UNION ALL
                SELECT {ld_date_expr} AS day, 0.0 AS sales, 0.0 AS cogs, 0 AS order_count, 0.0 AS expenses, 0.0 AS salaries, 0.0 AS commissions, amount AS ld_commissions
                FROM ld_commissions WHERE {ld_date_expr} BETWEEN ?1 AND ?2
            )
            WHERE day IS NOT NULL AND day != ''
            GROUP BY day
            ORDER BY day ASC
            "#
        ),
        p,
    )?;

    // Recent transactions (up to 25)
    let mut recent_sales = rows(
        &c,
        &format!("SELECT * FROM sales WHERE {sales_date_expr} BETWEEN ?1 AND ?2 ORDER BY id DESC LIMIT 25"),
        p,
    )?;
    for s in recent_sales.iter_mut() {
        let sid = s["id"].as_i64().unwrap_or(0);
        s["items"] = Value::Array(rows(&c, "SELECT * FROM sale_items WHERE sale_id=?", &[&sid])?);
    }

    // Recent Activity & Audit Trail
    let recent_activity = build_activity_feed(&c, &from, &to, 60)?;

    // Build Smart Actionable Notifications / Alerts
    let mut alerts = Vec::new();
    if products_out_of_stock > 0 {
        alerts.push(json!({
            "id": "alert-out-of-stock",
            "severity": "bad",
            "title": format!("{} Product{} Out of Stock", products_out_of_stock, if products_out_of_stock == 1 { "" } else { "s" }),
            "description": "Zero units remaining on shelf. Immediate restock required to prevent lost sales.",
            "timestamp": now(),
            "target_tab": "products",
            "filter": "out_of_stock"
        }));
    }
    if products_low_stock > 0 {
        alerts.push(json!({
            "id": "alert-low-stock",
            "severity": "warn",
            "title": format!("{} Product{} Running Low on Stock", products_low_stock, if products_low_stock == 1 { "" } else { "s" }),
            "description": "Stock level has reached or fallen below the configured reorder threshold.",
            "timestamp": now(),
            "target_tab": "products",
            "filter": "low_stock"
        }));
    }
    if open_shifts_count == 0 {
        alerts.push(json!({
            "id": "alert-shift-closed",
            "severity": "info",
            "title": "No Active Business Shift (SOD)",
            "description": "Cashier POS and expense recording are locked until Start of Day (SOD) is opened.",
            "timestamp": now(),
            "target_tab": "shifts",
            "filter": "open_sod"
        }));
    }
    if void_rate >= 5.0 && voided_n > 0.0 {
        alerts.push(json!({
            "id": "alert-high-void-rate",
            "severity": "warn",
            "title": format!("Elevated Void / Leakage Rate ({}%)", void_rate),
            "description": format!("{} voided receipt(s) totaling ₱{:.2} in the selected period. Review void reasons in Sales Audit.", voided_n as i64, voided),
            "timestamp": now(),
            "target_tab": "sales",
            "filter": "voided"
        }));
    }
    if net < 0.0 && (revenue > 0.0 || total_overheads > 0.0) {
        alerts.push(json!({
            "id": "alert-negative-net",
            "severity": "bad",
            "title": "Negative Net Operating Profit in Period",
            "description": format!("Total overheads (₱{:.2}) exceeded gross profit (₱{:.2}) by ₱{:.2}.", total_overheads, gross, (total_overheads - gross).abs()),
            "timestamp": now(),
            "target_tab": "overview",
            "filter": "negative_net"
        }));
    }
    // Check for cash shortage in shifts
    let shortage_shifts: Vec<&Value> = shift_history
        .iter()
        .filter(|s| {
            s["status"] == "closed"
                && (s["closing_cash"].as_f64().unwrap_or(0.0) - s["expected_cash"].as_f64().unwrap_or(0.0)) < -0.01
        })
        .collect();
    if !shortage_shifts.is_empty() {
        alerts.push(json!({
            "id": "alert-shift-shortage",
            "severity": "bad",
            "title": format!("{} Shift(s) Recorded Cash Drawer Shortage", shortage_shifts.len()),
            "description": "Counted closing cash was less than expected cash in drawer. Inspect Z-Readings in Shift Audit.",
            "timestamp": now(),
            "target_tab": "shifts",
            "filter": "shortage"
        }));
    }

    Ok(json!({
        "revenue": r2(revenue),
        "orders": count,
        "cogs": r2(cogs),
        "gross_profit": r2(gross),
        "gross_margin": gross_margin,
        "total_overheads": r2(total_overheads),
        "expenses": r2(expenses),
        "salaries": r2(salaries),
        "commissions": r2(commissions),
        "ld_commissions": r2(ld_commissions),
        "net_profit": r2(net),
        "net_margin": net_margin,
        "avg_ticket": avg_ticket,
        "voided_total": r2(voided),
        "voided_count": voided_n,
        "void_rate": void_rate,
        "inventory_cost": r2(inv_cost),
        "inventory_retail": r2(inv_retail),
        "potential_profit": r2(inv_retail - inv_cost),
        "previous_period": {
            "from": prev_from,
            "to": prev_to,
            "days": span_days,
            "revenue": r2(prev_revenue),
            "orders": prev_count,
            "cogs": r2(prev_cogs),
            "gross_profit": r2(prev_gross),
            "expenses": r2(prev_expenses),
            "salaries": r2(prev_salaries),
            "commissions": r2(prev_commissions),
            "ld_commissions": r2(prev_ld_commissions),
            "total_overheads": r2(prev_overheads),
            "net_profit": r2(prev_net),
            "avg_ticket": prev_avg_ticket,
            "voided_total": r2(prev_voided),
            "voided_count": prev_voided_n,
            "void_rate": prev_void_rate,
            "daily": prev_daily
        },
        "today": {
            "date": today_date,
            "revenue": r2(today_rev),
            "orders": today_ord,
            "expenses": r2(today_exp),
            "salaries": r2(today_sal),
            "commissions": r2(today_com),
            "ld_commissions": r2(today_ld),
            "net_profit": r2(today_net),
            "records_created": today_records as i64
        },
        "mtd": {
            "from": mtd_from,
            "to": mtd_to,
            "revenue": r2(mtd_rev),
            "orders": mtd_ord,
            "gross_profit": r2(mtd_gross),
            "total_overheads": r2(mtd_ovh),
            "net_profit": r2(mtd_net)
        },
        "counts": {
            "products_active": products_active,
            "products_healthy": products_healthy,
            "products_low_stock": products_low_stock,
            "products_out_of_stock": products_out_of_stock,
            "employees_active": employees_active,
            "cashiers_count": cashiers_count,
            "open_shifts_count": open_shifts_count,
            "completed_sales": count as i64,
            "voided_sales": voided_n as i64,
            "expenses_count": expenses_count,
            "salaries_count": salaries_count,
            "commissions_count": commissions_count,
            "ld_commissions_count": ld_commissions_count,
            "restocks_count": restocks_count,
            "shifts_count": shifts_count,
            "total_records": total_records
        },
        "hourly": hourly,
        "categories": categories,
        "product_performance": product_performance,
        "catalog_performance": catalog_performance,
        "variant_sales": variant_sales,
        "low_stock_items": low_stock_items,
        "expense_categories": expense_categories,
        "shift_history": shift_history,
        "top_employees": top_employees,
        "daily": daily,
        "recent_sales": recent_sales,
        "recent_activity": recent_activity,
        "alerts": alerts
    }))
}
