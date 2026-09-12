use crate::cli;
use serde_json::Value;

pub fn value() -> i32 {
    let _v: Option<Value> = None;
    cli::enabled() as i32
}
