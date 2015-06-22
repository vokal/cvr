#!/bin/bash

npm run testcover

RESULT=$?

sed -i 's/\/var\/cache\/drone\/src\/github.com\/vokal\/cvr\///g' coverage/lcov.info
GITHASH="$(git rev-parse HEAD)"
curl -F coverage=@coverage/lcov.info "https://cvr.vokal.io/coverage?token=$CVR_TOKEN&commit=$GITHASH&coveragetype=lcov"

exit $RESULT

