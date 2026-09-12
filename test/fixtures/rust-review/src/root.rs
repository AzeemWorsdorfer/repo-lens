mod child;
#[path = "main.rs"]
mod worker;
#[path = "extra.rs"]
mod renamed;
mod outer {
    mod service;
}

use crate::{outer::service::*};
use child::VALUE;
