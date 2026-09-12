use std::collections::HashMap;

pub fn has() -> bool {
    let map: HashMap<String, i32> = HashMap::new();
    !map.is_empty()
}
