import { describe, expect, it, vi } from 'vitest'
import { completeR2Upload, abortR2Upload } from '../src/lib/media-storage'
describe('R2 multipart recovery', () => {
  it('verifies the committed HEAD instead of trusting completion-response metadata', async () => {
    const stored = { size: 123, customMetadata: { assetid: 'clip' } }
    const complete = vi.fn().mockResolvedValue({ size: 123 })
    const head = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(stored)
    const bucket = { head, resumeMultipartUpload: () => ({ complete }) } as unknown as R2Bucket
    expect(
      await completeR2Upload(bucket, 'clip', 'upload', [{ partNumber: 1, etag: 'etag' }]),
    ).toEqual(stored)
    expect(head).toHaveBeenCalledTimes(2)
    expect(complete).toHaveBeenCalledTimes(1)
  })
  it('recovers a lost completion response and does not complete an already stored original again', async () => {
    const stored = { size: 123, customMetadata: { assetid: 'clip' } }
    const complete = vi.fn().mockRejectedValue(new Error('connection closed'))
    const head = vi.fn().mockResolvedValueOnce(null).mockResolvedValue(stored)
    const bucket = { head, resumeMultipartUpload: () => ({ complete }) } as unknown as R2Bucket
    expect(await completeR2Upload(bucket, 'clip', 'upload', [])).toEqual(stored)
    expect(await completeR2Upload(bucket, 'clip', 'upload', [])).toEqual(stored)
    expect(complete).toHaveBeenCalledTimes(1)
  })
  it('propagates completion failures when no object was stored', async () => {
    const bucket = {
      head: vi.fn().mockResolvedValue(null),
      resumeMultipartUpload: () => ({
        complete: vi.fn().mockRejectedValue(new Error('R2 unavailable')),
      }),
    } as unknown as R2Bucket
    await expect(completeR2Upload(bucket, 'clip', 'upload', [])).rejects.toThrow('R2 unavailable')
  })
  it('continues deleting after an upload has completed or expired, while preserving real failures', async () => {
    await expect(
      abortR2Upload({
        abort: vi
          .fn()
          .mockRejectedValue(new Error('abort: Multipart upload does not exist. (10024)')),
      } as unknown as R2MultipartUpload),
    ).resolves.toBeUndefined()
    await expect(
      abortR2Upload({
        abort: vi.fn().mockRejectedValue(new Error('abort: Service unavailable. (10043)')),
      } as unknown as R2MultipartUpload),
    ).rejects.toThrow('10043')
  })
})
