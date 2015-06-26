#!/bin/bash

npm run testcover

RESULT=$?

GITHASH="$(git rev-parse HEAD)"
curl -F coverage=@coverage/lcov.info "https://cvr.vokal.io/coverage?token=$CVR_TOKEN&commit=$GITHASH&removepath=/var/cache/drone/src/github.com/vokal/cvr/&coveragetype=lcov"

exit $RESULT

