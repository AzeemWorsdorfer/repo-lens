use crate::{service::auth, nested::leaf::reader as r};
use crate::cli as c;

pub fn classify(value: i32) -> &'static str {
    if value > 0 {
        match value {
            1 => "one",
            _ => "many",
        }
    } else {
        "none"
    }
}

pub fn aliased() -> bool {
    c::enabled() && r::has()
}
