use super::child;
use super::*;
use crate::{missing::*};
use crate::outer::child::VALUE;

pub fn value() -> i32 {
    child::VALUE
}

pub fn nested() {
    use crate::outer::service::SERVICE;
    let _ = SERVICE;
}
