mod reader;

use self::reader;
use super::super::cli;
use std::collections::HashMap;

pub fn ready() -> bool {
    let map: HashMap<String, i32> = HashMap::new();
    if reader::has() {
        return !map.is_empty();
    }
    false
}
