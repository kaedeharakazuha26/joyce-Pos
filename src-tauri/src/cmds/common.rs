use rusqlite::{params, types::ValueRef, Connection, ToSql};
use serde_json::{json, Map, Value};

pub type R<T> = Result<T, String>;

pub fn e<E: ToString>(x: E) -> String {
    x.to_string()
}

pub fn now() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn get_active_shift(c: &Connection) -> Option<(i64, String)> {
    c.query_row(
        "SELECT id, business_date FROM shifts WHERE status='open' ORDER BY id DESC LIMIT 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).ok()
}

pub fn active_business_date(c: &Connection) -> String {
    get_active_shift(c).map(|(_, d)| d).unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string())
}

pub fn business_now(c: &Connection) -> String {
    let bdate = active_business_date(c);
    let time = chrono::Local::now().format("%H:%M:%S");
    format!("{} {}", bdate, time)
}

pub fn num(v: &Value, k: &str) -> f64 {
    v.get(k).and_then(|x| x.as_f64()).unwrap_or(0.0)
}

pub fn text(v: &Value, k: &str) -> String {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("").trim().to_string()
}

pub fn r2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

/// Runs a query and returns each row as a JSON object keyed by column name.
pub fn rows(c: &Connection, sql: &str, p: &[&dyn ToSql]) -> R<Vec<Value>> {
    let mut st = c.prepare(sql).map_err(e)?;
    let names: Vec<String> = st.column_names().iter().map(|s| s.to_string()).collect();
    let it = st
        .query_map(p, |r| {
            let mut m = Map::new();
            for (i, n) in names.iter().enumerate() {
                let v = match r.get_ref(i)? {
                    ValueRef::Null | ValueRef::Blob(_) => Value::Null,
                    ValueRef::Integer(x) => json!(x),
                    ValueRef::Real(x) => json!(x),
                    ValueRef::Text(t) => json!(String::from_utf8_lossy(t)),
                };
                m.insert(n.clone(), v);
            }
            Ok(Value::Object(m))
        })
        .map_err(e)?;
    it.collect::<Result<Vec<_>, _>>().map_err(e)
}

pub fn scalar(c: &Connection, sql: &str, p: &[&dyn ToSql]) -> f64 {
    c.query_row(sql, p, |r| r.get::<_, f64>(0)).unwrap_or(0.0)
}

pub fn log_audit(
    c: &Connection,
    actor: &str,
    role: &str,
    action: &str,
    entity_type: &str,
    entity_id: &str,
    summary: &str,
    details: Value,
) {
    let ts = now();
    let actor_clean = if actor.trim().is_empty() { "Administrator" } else { actor.trim() };
    let role_clean = if role.trim().is_empty() { "admin" } else { role.trim() };
    let _ = c.execute(
        "INSERT INTO audit_logs(timestamp, actor, role, action, entity_type, entity_id, summary, details_json) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![ts, actor_clean, role_clean, action, entity_type, entity_id, summary, details.to_string()],
    );
}
