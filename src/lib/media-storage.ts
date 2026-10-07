// R2's multipart completion response can omit stored custom metadata. Always
// read the committed object before verification, including on a retry after a
// successful completion whose response or database commit was lost.
export async function completeR2Upload(
  bucket: R2Bucket,
  key: string,
  uploadId: string,
  parts: R2UploadedPart[],
) {
  let object = await bucket.head(key)
  if (object) return object
  try {
    await bucket.resumeMultipartUpload(key, uploadId).complete(parts)
  } catch (error) {
    object = await bucket.head(key)
    if (!object) throw error
    return object
  }
  return bucket.head(key)
}
export async function abortR2Upload(upload: R2MultipartUpload) {
  try {
    await upload.abort()
  } catch (error) {
    // NoSuchUpload is expected after completion, earlier cancellation, or R2's
    // lifecycle expiry. Other failures must retain the durable deletion intent.
    if (!(error instanceof Error) || !/\(10024\)\s*$/.test(error.message)) throw error
  }
}
