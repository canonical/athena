#!/bin/sh
set -eu

npm run build:be
exec npm run start:worker
