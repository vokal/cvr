#!/bin/bash

npm run testcover

RESULT=$?

GITHASH=git rev-parse HEAD
COVERAGE=$(<coverage/lcov.info)
curl --data "token=$CVR_TOKEN&commit=$GITHASH&coverage=$COVERAGE&coveragetype=lcov" https://cvr.vokal.io/coverage

exit $RESULT

