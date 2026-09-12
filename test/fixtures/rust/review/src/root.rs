mod child;
#[path = "extra.rs"]
mod renamed;
mod outer {
    mod service;
}

use crate::{outer::service::*};
use child::VALUE;
