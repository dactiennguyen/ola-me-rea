//! Sent 1-1 messages, kept in SQLite (`messages.db` in the app data dir) so the
//! app can show who was already messaged, from which account and when. Each
//! row is one message the user sent by hand; nothing here sends anything.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

const FILE: &str = "messages.db";

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS sent_messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sent_at         INTEGER NOT NULL,          -- ms since epoch
    account_id      TEXT    NOT NULL,          -- id in accounts.json
    account_uid     TEXT    NOT NULL,          -- sender's Ola uid
    account_label   TEXT    NOT NULL,
    peer_uid        TEXT    NOT NULL,
    peer_name       TEXT    NOT NULL,
    message_id      TEXT    NOT NULL,
    text            TEXT    NOT NULL,
    source          TEXT    NOT NULL,          -- screen the message was sent from
    push_ok         INTEGER,                   -- NULL: no push attempted
    last_message_ok INTEGER,                   -- addLastMessage5 result; NULL: not attempted
    error           TEXT,
    dry_run         INTEGER NOT NULL DEFAULT 0 -- Chế độ thử: not sent to the server
);
CREATE INDEX IF NOT EXISTS sent_messages_peer ON sent_messages (peer_uid);
CREATE INDEX IF NOT EXISTS sent_messages_time ON sent_messages (sent_at);
";

/// Opened on first use.
#[derive(Default)]
pub struct SentLog(Mutex<Option<Connection>>);

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SentEntry {
    pub sent_at: i64,
    pub account_id: String,
    pub account_uid: String,
    pub account_label: String,
    pub peer_uid: String,
    pub peer_name: String,
    pub message_id: String,
    pub text: String,
    pub source: String,
    pub push_ok: Option<bool>,
    pub last_message_ok: Option<bool>,
    pub error: Option<String>,
    pub dry_run: bool,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SentRow {
    pub id: i64,
    #[serde(flatten)]
    pub entry: SentEntry,
}

/// Per peer and sending account: how many real (not dry-run) messages, and the last time.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Contact {
    pub peer_uid: String,
    pub account_id: String,
    pub account_label: String,
    pub count: i64,
    pub last_sent_at: i64,
}

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(SCHEMA)?;
    Ok(conn)
}

pub fn add(conn: &Connection, e: &SentEntry) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO sent_messages (sent_at, account_id, account_uid, account_label, peer_uid,
            peer_name, message_id, text, source, push_ok, last_message_ok, error, dry_run)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            e.sent_at,
            e.account_id,
            e.account_uid,
            e.account_label,
            e.peer_uid,
            e.peer_name,
            e.message_id,
            e.text,
            e.source,
            e.push_ok,
            e.last_message_ok,
            e.error,
            e.dry_run
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn recent(conn: &Connection, limit: u32) -> rusqlite::Result<Vec<SentRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, sent_at, account_id, account_uid, account_label, peer_uid, peer_name,
                message_id, text, source, push_ok, last_message_ok, error, dry_run
         FROM sent_messages ORDER BY sent_at DESC, id DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map([limit.min(1000)], |r| {
        Ok(SentRow {
            id: r.get(0)?,
            entry: SentEntry {
                sent_at: r.get(1)?,
                account_id: r.get(2)?,
                account_uid: r.get(3)?,
                account_label: r.get(4)?,
                peer_uid: r.get(5)?,
                peer_name: r.get(6)?,
                message_id: r.get(7)?,
                text: r.get(8)?,
                source: r.get(9)?,
                push_ok: r.get(10)?,
                last_message_ok: r.get(11)?,
                error: r.get(12)?,
                dry_run: r.get(13)?,
            },
        })
    })?;
    rows.collect()
}

pub fn contacts(conn: &Connection) -> rusqlite::Result<Vec<Contact>> {
    let mut stmt = conn.prepare(
        "SELECT peer_uid, account_id,
                (SELECT account_label FROM sent_messages l
                  WHERE l.peer_uid = s.peer_uid AND l.account_id = s.account_id
                  ORDER BY l.sent_at DESC LIMIT 1),
                COUNT(*), MAX(sent_at)
         FROM sent_messages s WHERE dry_run = 0
         GROUP BY peer_uid, account_id",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Contact {
            peer_uid: r.get(0)?,
            account_id: r.get(1)?,
            account_label: r.get(2)?,
            count: r.get(3)?,
            last_sent_at: r.get(4)?,
        })
    })?;
    rows.collect()
}

fn with_db<T>(
    app: &tauri::AppHandle,
    log: &SentLog,
    run: impl FnOnce(&Connection) -> rusqlite::Result<T>,
) -> Result<T, String> {
    let mut guard = log
        .0
        .lock()
        .map_err(|_| "messages.db is unavailable".to_string())?;
    if guard.is_none() {
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        *guard = Some(open(&dir.join(FILE)).map_err(|e| e.to_string())?);
    }
    run(guard.as_ref().expect("opened above")).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sent_log_add(
    app: tauri::AppHandle,
    log: State<'_, SentLog>,
    entry: SentEntry,
) -> Result<i64, String> {
    with_db(&app, &log, |conn| add(conn, &entry))
}

#[tauri::command]
pub fn sent_log_recent(
    app: tauri::AppHandle,
    log: State<'_, SentLog>,
    limit: u32,
) -> Result<Vec<SentRow>, String> {
    with_db(&app, &log, |conn| recent(conn, limit))
}

#[tauri::command]
pub fn sent_log_contacts(
    app: tauri::AppHandle,
    log: State<'_, SentLog>,
) -> Result<Vec<Contact>, String> {
    with_db(&app, &log, contacts)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(peer: &str, account: &str, at: i64, dry_run: bool) -> SentEntry {
        SentEntry {
            sent_at: at,
            account_id: account.into(),
            account_uid: format!("uid-{account}"),
            account_label: format!("Nick {account}"),
            peer_uid: peer.into(),
            peer_name: format!("Peer {peer}"),
            message_id: format!("{at}uid-{account}"),
            text: "xin chào".into(),
            source: "outreach".into(),
            push_ok: None,
            last_message_ok: Some(true),
            error: None,
            dry_run,
        }
    }

    #[test]
    fn stores_and_summarizes() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        add(&conn, &entry("p1", "a", 100, false)).unwrap();
        add(&conn, &entry("p1", "a", 300, false)).unwrap();
        add(&conn, &entry("p1", "b", 200, false)).unwrap();
        add(&conn, &entry("p2", "a", 400, true)).unwrap();

        let rows = recent(&conn, 10).unwrap();
        assert_eq!(rows.len(), 4);
        assert_eq!(rows[0].entry, entry("p2", "a", 400, true));
        assert_eq!(rows[3].entry.sent_at, 100);

        let mut found = contacts(&conn).unwrap();
        found.sort_by(|x, y| x.account_id.cmp(&y.account_id));
        assert_eq!(found.len(), 2, "dry-run messages are not contacts");
        assert_eq!(
            (
                found[0].account_id.as_str(),
                found[0].count,
                found[0].last_sent_at
            ),
            ("a", 2, 300)
        );
        assert_eq!(
            (
                found[1].account_id.as_str(),
                found[1].count,
                found[1].last_sent_at
            ),
            ("b", 1, 200)
        );
    }

    #[test]
    fn schema_is_idempotent() {
        let dir = std::env::temp_dir().join(format!("ola-sentlog-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir); // left over from an interrupted run
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(FILE);
        add(&open(&path).unwrap(), &entry("p", "a", 1, false)).unwrap();
        assert_eq!(recent(&open(&path).unwrap(), 5).unwrap().len(), 1);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
