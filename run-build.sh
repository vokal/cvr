#!/bin/bash

npm run testcover

RESULT=$?

GITHASH=git rev-parse HEAD
COVERAGE=$(<coverage/lcov.info)
curl --data "token=9f60266e3e1ee615124696ad17a5e288&commit=$GITHASH&coverage=$COVERAGE&coveragetype=lcov" https://cvr.vokal.io/coverage

exit $RESULT

