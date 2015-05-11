# aws-lambda-create-thumbnail

# Description
An [AWS Lambda](http://aws.amazon.com/lambda/) function that outputs thumbnail for images uploaded to S3.

## Setup
1. Install node.js, preferably through [nvm](/creationix/nvm). Lambda uses an older version of node (currently v0.10.33), so it would be best use the same version--especially when installing dependencies via npm.
1. Clone this repo
1. Run `npm install`
1. Create a config.json file (see below), or modify the index.js file for your purposes
1. Create your buckets
1. Run Gulp
1. Create and upload your Lambda function
1. Invoke the lambda function by uploading an image to your source bucket or run it manually in the AWS console.

# AWS Configuration
Just need to set up the S3 buckets and Upload the Lambda function (dist.zip).

## Lambda Function
Downloads the file that gets uploaded to the source bucket and outputs a thumbnail image to the destination bucket.  

### IAM Execution Role Policy
```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:*"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject"
            ],
            "Resource": [
                "arn:aws:s3:::source-bucket/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject"
            ],
            "Resource": [
                "arn:aws:s3:::destination-bucket/*"
            ]
        }
    ]
}
```

### config.json
```JSON
{
  "srcBucket" : "userassets",
  "secret" : "superlambdasecret"
}
```

## S3 Buckets
You'll need to create 2 buckets, a source bucket and a destination bucket. You could probably get away with one bucket and a fancy prefix policy, but that's probably more of a hassle than it's worth.

The source bucket should be configured to trigger Lambda events.

# Testing
Sample file if you want to run a test locally. Modify the bucket name and object key.

```JavaScript
var lambda = require('./index').handler;

lambda({
  Records: [{
    eventVersion: '2.0',
    eventSource: 'aws:s3',
    awsRegion: 'us-east-1',
    eventTime: '2015-04-09T00:00:00.000Z',
    eventName: 'ObjectCreated:Post',
    userIdentity: {principalId: 'XXXXXXXXXXXXXX'},
    requestParameters: {sourceIPAddress: '10.0.0.1'},
    responseElements: {
      'x-amz-request-id': 'AAAAAAAAAAAAAAAA',
      'x-amz-id-2': 'example+uvBeYL11YHRGvzOb5qQz7cwxh7AzPlE+zuM2zRN6vTvd/1Qe0TJpKPCvZBoO4dB0gqM='
    },
    s3: {
      s3SchemaVersion: '1.0',
      configurationId: 'ProcessUploads',
      bucket: {
        name: 'source-bucket',
        ownerIdentity: {principalId: 'XXXXXXXXXXXXXX'},
        arn: 'arn:aws:s3:::source-bucket'
      },
      object: {
        key: 'us-east-1%3A8ca8d677-aaaa-aaaa-aaaa-b75e887648ee/public/0524d7ce-aaaa-aaaa-aaaa-1f8cf05b3862.png',
        size: 1000000,
        eTag: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      }
    }
  }]
}, {
  fail: function (error) {
    console.log('Failed:', error);
    process.exit(1);
  },
  succeed: function(result) {
    console.log('Succeeded:', result);
    process.exit();
  }
});
```

# Gotchas
- The object key from the event is URL encoded. Spaces in the filenames might be replaced with `+` so be aware of this and handle errors appropriately. If you try to download the file with the AWS SDK for JavaScript like in this example, without handling this, it will throw an error.
- Not handling errors with context.fail(error) will cause the function to run until the timeout is reached. 