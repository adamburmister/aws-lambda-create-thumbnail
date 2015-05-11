// dependencies
var async   = require('async');
var AWS     = require('aws-sdk');
var gm      = require('gm').subClass({ imageMagick: true }); // Enable ImageMagick integration.
var util    = require('util');
var request = require('request');
var config  = require('config');

// constants
var THUMB_WIDTH  = config.thumbnailWidth;
var THUMB_HEIGHT = config.thumbnailHeight;
var ALLOWED_FILETYPES = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'pdf', 'gif'];

var utils = {
  decodeKey: function(key) {
    return decodeURIComponent(key).replace(/\+/g, ' ');
  }
};

// get reference to S3 client 
var s3 = new AWS.S3();
 
exports.handler = function(event, context) {
  // Read options from the event.
  console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
  var srcBucket = event.Records[0].s3.bucket.name;
  var srcKey    = utils.decodeKey(event.Records[0].s3.object.key);
  var dstBucket = srcBucket + "/thumbnails/";
  var dstKey    = "thumb-" + srcKey;

  // Sanity check: validate that source and destination are different buckets.
  if (srcBucket == dstBucket) {
    console.error("Destination bucket must not match source bucket.");
    return;
  }

  // Infer the image type.
  var typeMatch = srcKey.match(/\.([^.]*)$/);
  if (!typeMatch) {
    console.error('unable to infer image type for key ' + srcKey);
    return;
  }

  var imageType = typeMatch[1];
  if (ALLOWED_FILETYPES.indexOf(imageType.toLowerCase()) < 0) {
    console.log('skipping non-image ' + srcKey);
    return;
  }

  // Download the image from S3, transform, and upload to a different S3 bucket.
  async.waterfall([
    function download(next) {
      // Download the image from S3 into a buffer.
      s3.getObject({
        Bucket : srcBucket,
        Key    : srcKey
      }, next);
    },
    function tranform(response, next) {
      gm(response.Body).size(function(err, size) {
        // Infer the scaling factor to avoid stretching the image unnaturally.
        var scalingFactor = Math.min(
          THUMB_WIDTH / size.width,
          THUMB_HEIGHT / size.height
        );
        var width  = scalingFactor * size.width;
        var height = scalingFactor * size.height;

        console.log('Resizing, size:' + size.width + ':' + size.height + ' length:' + response.Body.length);

        // Transform the image buffer in memory.
        this.resize(width, height)
          .toBuffer(function(err, buffer) {
            if (err) {
              console.error('Error resizing image: ' + err);
              next(err);
            } else {
              next(null, response.ContentType, buffer);
            }
          });
      });
    },
    function upload(contentType, data, next) {
      // Stream the transformed image to a different S3 bucket.
      s3.putObject({
        Bucket      : dstBucket,
        Key         : dstKey,
        Body        : data,
        ContentType : contentType
      }, next);
    }],
    function (err) {
      if (err) {
        console.error(
          'Unable to resize ' + srcBucket + '/' + srcKey +
          ' and upload to ' + dstBucket + '/' + dstKey +
          ' due to an error: ' + err
        );
        context.done();
      } else {
        console.log(
          'Successfully resized ' + srcBucket + '/' + srcKey +
          ' and uploaded to ' + dstBucket + '/' + dstKey
        );

        // hash-fileId.ext
        var fileMatch = srcKey.match(/\-([^.]*)\./);

        if (!fileMatch) {
          context.done();
        } else {
          var fileId = fileMatch[1];

          console.log('fileId = ' + fileId);

          // request.post(config.home.host + '/api/files/' + fileId + '/thumbnail', {
          //   form : {
          //     bucket : config.home.bucket,
          //     secret : config.home.secret
          //   }
          // }, function(err, response, body) {
          //   err && console.log('could not make request back: ' + err);
          //   context.done();
          // });
        }
      }
    }
  );
};
