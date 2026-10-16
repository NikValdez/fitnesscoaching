import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  embeddedObjects,
  publicDiscovery,
  publicPage,
  publicProfile,
  publicVideo,
} from '../src/lib/analytics-public'
import { coachingAnalyticsAccounts } from '../src/lib/analytics-accounts'
import { normalizeVideo } from '../src/lib/analytics-parsers'
import {
  analyticsActionSchema,
  csvCell,
  engagement,
  parseAnalyticsUrl,
  parseCSV,
  type AnalyticsItem,
} from '../src/lib/analytics-validation'

const item = (url: string): AnalyticsItem => {
  const parsed = parseAnalyticsUrl(url)
  return {
    ...parsed,
    id: 'd3bf62da-d641-4b16-98b4-ae61f327da11',
    title: 'Test post',
    version: 1,
    updatedAt: '2026-10-14T00:00:00Z',
    tags: [],
    notes: '',
  }
}
const html = (data: unknown) => `<script type="application/json">${JSON.stringify(data)}</script>`
afterEach(() => vi.unstubAllGlobals())

describe('public social collection', () => {
  it('matches Instagram profile and post identities, preserves missing counts, and reads nested serialized data', () => {
    const objects = embeddedObjects(
      html({
        data: JSON.stringify({
          user: {
            username: 'steverossiter_',
            full_name: 'Steve',
            edge_followed_by: { count: 2135 },
          },
          media: [
            { shortcode: 'OTHER', edge_media_preview_like: { count: 99999 } },
            {
              shortcode: 'TEST',
              edge_media_preview_like: { count: 491 },
              edge_media_to_parent_comment: { count: 49 },
            },
          ],
        }),
      }),
    )
    expect(
      publicProfile(item('https://instagram.com/steverossiter_/'), objects).metrics.followers,
    ).toBe(2135)
    expect(publicVideo(item('https://instagram.com/reel/TEST/'), objects).metrics).toEqual({
      views: null,
      likes: 491,
      comments: 49,
      shares: null,
      saves: null,
    })
    expect(() => publicVideo(item('https://instagram.com/reel/MISSING/'), objects)).toThrow(
      'did not expose',
    )
    expect(
      normalizeVideo('instagram', { shortcode: 'ZERO', like_count: 0, comment_count: 0 }).metrics
        .likes,
    ).toBe(0)
  })
  it('uses the TikTok public embed without cookies or API credentials and keeps hidden saves unavailable', async () => {
    const request = vi.fn(
      async (_url: unknown, _options: RequestInit) =>
        new Response(
          html({
            post: {
              itemInfos: {
                id: '123456789',
                text: 'Strength training',
                playCount: 953,
                diggCount: 16,
                commentCount: 3,
                shareCount: 0,
              },
              authorInfos: { uniqueId: 'coach' },
            },
          }),
        ),
    )
    vi.stubGlobal('fetch', request)
    const budget = vi.fn(async () => {})
    const result = await publicPage(item('https://tiktok.com/@coach/video/123456789'), budget)
    expect(String(request.mock.calls[0][0])).toBe('https://www.tiktok.com/embed/v2/123456789')
    expect(request.mock.calls[0][1]).toMatchObject({
      redirect: 'manual',
      headers: { Accept: 'text/html' },
    })
    expect(request.mock.calls[0][1].headers).not.toHaveProperty('Cookie')
    expect(request.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
    expect(result).toMatchObject({
      source: 'tiktok-embed',
      metrics: { views: 953, likes: 16, comments: 3, shares: 0, saves: null },
    })
    expect(budget).toHaveBeenCalledTimes(1)
  })
  it('discovers only matching Instagram posts and deduplicates the public feed', async () => {
    const post = { media_type: 2, code: 'ONE', user: { username: 'coach' }, like_count: 12 }
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            html({ data: [post, post, { ...post, code: 'OTHER', user: { username: 'other' } }] }),
          ),
      ),
    )
    const result = await publicDiscovery(item('https://instagram.com/coach/'))
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      url: 'https://www.instagram.com/p/ONE/',
      metrics: { likes: 12, views: null },
    })
  })
  it('combines the Instagram main feed with owned Reels-grid play counts and resolves numeric owner references', async () => {
    const profile = { username: 'coach', pk: '123', id: '456', follower_count: 400 }
    const main = {
      media_type: 2,
      code: 'ONE',
      user: { username: 'coach' },
      caption: { text: 'Training' },
    }
    const reel = {
      product_type: 'clips',
      code: 'ONE',
      user: { pk: '123' },
      play_count: 1249,
      like_count: 12,
    }
    const older = { ...reel, code: 'TWO', user: { id: '456' }, play_count: 2172 }
    const request = vi.fn(
      async (url: string) =>
        new Response(
          html({
            data: url.endsWith('/reels/')
              ? [
                  profile,
                  reel,
                  older,
                  { ...reel, code: 'OTHER', user: { pk: '999' }, play_count: 99999 },
                  { ...reel, code: 'MISMATCH', user: { pk: '123', username: 'other' } },
                ]
              : [profile, main],
          }),
        ),
    )
    vi.stubGlobal('fetch', request)
    const budget = vi.fn(async () => {})
    const result = await publicDiscovery(item('https://instagram.com/coach/'), budget)
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      'https://www.instagram.com/coach/',
      'https://www.instagram.com/coach/reels/',
    ])
    expect(budget).toHaveBeenCalledTimes(2)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      url: 'https://www.instagram.com/p/ONE/',
      title: 'Training',
      mediaType: 'video',
      metrics: { views: 1249, likes: 12 },
    })
    expect(result.rows[1]).toMatchObject({
      url: 'https://www.instagram.com/p/TWO/',
      metrics: { views: 2172 },
    })
  })
  it('fills missing individual Reel views from the exact owned Reels-grid entry without credentials', async () => {
    const request = vi.fn(
      async (url: string, _options: RequestInit) =>
        new Response(
          html(
            url.endsWith('/reels/')
              ? [
                  { username: 'coach', pk: '123' },
                  { code: 'ONE', product_type: 'clips', user: { pk: '123' }, play_count: 1249 },
                  { code: 'OTHER', product_type: 'clips', user: { pk: '123' }, play_count: 99999 },
                ]
              : {
                  code: 'ONE',
                  media_type: 2,
                  user: { username: 'coach' },
                  like_count: 12,
                  comment_count: 4,
                },
          ),
        ),
    )
    vi.stubGlobal('fetch', request)
    const result = await publicPage(item('https://instagram.com/reel/ONE/'))
    expect(result).toMatchObject({
      mediaType: 'video',
      metrics: { views: 1249, likes: 12, comments: 4 },
    })
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      'https://www.instagram.com/p/ONE/',
      'https://www.instagram.com/coach/reels/',
    ])
    expect(request.mock.calls[1][1].headers).not.toHaveProperty('Cookie')
    expect(request.mock.calls[1][1].headers).not.toHaveProperty('Authorization')
  })
  it('keeps photo/carousel views unavailable and never substitutes another Reel or a disabled count', async () => {
    const request = vi.fn(
      async () =>
        new Response(
          html({ code: 'PHOTO', media_type: 8, user: { username: 'coach' }, like_count: 12 }),
        ),
    )
    vi.stubGlobal('fetch', request)
    expect(await publicPage(item('https://instagram.com/p/PHOTO/'))).toMatchObject({
      mediaType: 'carousel',
      metrics: { views: null, likes: 12 },
    })
    expect(request).toHaveBeenCalledTimes(1)
    request.mockImplementation(
      async () =>
        new Response(
          html([
            { username: 'coach', pk: '123' },
            { code: 'ONE', media_type: 2, user: { username: 'coach' }, like_count: 10 },
            { code: 'OTHER', product_type: 'clips', user: { pk: '123' }, play_count: 99999 },
          ]),
        ),
    )
    expect((await publicPage(item('https://instagram.com/p/ONE/'))).metrics).toHaveProperty(
      'views',
      null,
    )
    expect(
      normalizeVideo('instagram', {
        code: 'HIDDEN',
        product_type: 'clips',
        like_and_view_counts_disabled: true,
        play_count: 0,
        like_count: 0,
      }).metrics,
    ).toMatchObject({ views: null, likes: null })
    expect(
      normalizeVideo('instagram', { code: 'ZERO', product_type: 'clips', play_count: 0 }).metrics
        .views,
    ).toBe(0)
  })
  it('rejects login and off-platform redirects before making another request', async () => {
    for (const location of [
      'https://evil.test/steverossiter_/',
      '/accounts/login/',
      '/other/',
      'https://tiktok.com/@steverossiter_',
    ]) {
      const request = vi.fn(
        async () => new Response(null, { status: 302, headers: { Location: location } }),
      )
      vi.stubGlobal('fetch', request)
      await expect(publicPage(item('https://instagram.com/steverossiter_/'))).rejects.toThrow(
        'requires a login',
      )
      expect(request).toHaveBeenCalledTimes(1)
    }
  })
  it('bounds response size and counts same-identity redirects against the request budget', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { Location: '/coach/?hl=en' } }),
      )
      .mockResolvedValueOnce(new Response(html({ username: 'coach', follower_count: 12 })))
    vi.stubGlobal('fetch', request)
    const budget = vi.fn(async () => {})
    expect((await publicPage(item('https://instagram.com/coach/'), budget)).metrics).toMatchObject({
      followers: 12,
    })
    expect(budget).toHaveBeenCalledTimes(2)
    request.mockResolvedValue(new Response('x'.repeat(2 * 1024 * 1024 + 1)))
    await expect(publicPage(item('https://instagram.com/coach/'))).rejects.toThrow('too large')
  })
  it('reads only the requested YouTube channel subscriber count and treats a verified empty channel as an empty feed', async () => {
    const data = {
      metadata: {
        channelMetadataRenderer: {
          externalId: 'UCfixture',
          title: 'Steve',
          ownerUrls: ['http://www.youtube.com/@steverossiter_'],
          channelUrl: 'https://www.youtube.com/channel/UCfixture',
        },
      },
      header: {
        pageHeaderRenderer: {
          content: {
            pageHeaderViewModel: {
              metadata: {
                contentMetadataViewModel: {
                  metadataRows: [
                    {
                      metadataParts: [
                        { text: { content: '@steverossiter_' } },
                        { text: { content: '21 subscribers' } },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
      empty: { simpleText: "This channel doesn't have any content" },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(html(data))),
    )
    const channel = item('https://www.youtube.com/@steverossiter_')
    expect((await publicPage(channel)).metrics).toMatchObject({ followers: 21 })
    expect((await publicDiscovery(channel)).rows).toEqual([])
    expect(() =>
      publicProfile(item('https://www.youtube.com/@other'), embeddedObjects(html(data))),
    ).toThrow('did not expose')
    data.header.pageHeaderRenderer.content.pageHeaderViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[1].text.content =
      '1.2K subscribers'
    expect(() => publicProfile(channel, embeddedObjects(html(data)))).toThrow('did not expose')
  })
  it('discovers YouTube uploads and Shorts while excluding another channel’s recommendations', async () => {
    const metadata = {
      channelMetadataRenderer: {
        externalId: 'UCfixture',
        title: 'Steve',
        ownerUrls: ['https://www.youtube.com/@steverossiter_'],
      },
    }
    const tabs = [
      {
        tabRenderer: {
          title: 'Videos',
          selected: true,
          content: {
            contents: [
              {
                videoRenderer: {
                  videoId: 'abcdefghijk',
                  title: { runs: [{ text: 'Strength' }] },
                  viewCountText: { simpleText: '1,234 views' },
                },
              },
              {
                videoRenderer: {
                  videoId: 'otherabcdef',
                  title: { runs: [{ text: 'Another creator' }] },
                  ownerText: {
                    runs: [{ navigationEndpoint: { browseEndpoint: { browseId: 'UCother' } } }],
                  },
                },
              },
            ],
          },
        },
      },
      { tabRenderer: { title: 'Shorts', selected: false } },
    ]
    const request = vi.fn(
      async (url: string) =>
        new Response(
          html({
            metadata,
            tabs: url.endsWith('/shorts')
              ? [
                  {
                    tabRenderer: {
                      title: 'Shorts',
                      selected: true,
                      content: {
                        contents: [
                          {
                            shortsLockupViewModel: {
                              onTap: {
                                innertubeCommand: { reelWatchEndpoint: { videoId: 'shortabcdef' } },
                              },
                              overlayMetadata: {
                                primaryText: { content: 'Quick tip' },
                                secondaryText: { content: '57 views' },
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                ]
              : tabs,
          }),
        ),
    )
    vi.stubGlobal('fetch', request)
    const result = await publicDiscovery(item('https://www.youtube.com/@steverossiter_'))
    expect(result.rows.map((row) => row.url)).toEqual([
      'https://www.youtube.com/watch?v=abcdefghijk',
      'https://www.youtube.com/watch?v=shortabcdef',
    ])
    expect(result.rows.map((row) => row.metrics.views)).toEqual([1234, 57])
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[1][0]).toBe('https://www.youtube.com/@steverossiter_/shorts')
  })
  it('accepts Facebook’s same-profile people redirect, reads its own followers and does not confuse following with followers', async () => {
    const profile = {
      id: '61595143955478',
      name: 'Steve',
      profile_social_context: {
        content: [
          {
            uri: 'https://www.facebook.com/profile.php?id=61595143955478&sk=following',
            text: { text: '0 following' },
          },
          {
            uri: 'https://www.facebook.com/profile.php?id=OTHER&sk=followers',
            text: { text: '999 followers' },
          },
          {
            uri: 'https://www.facebook.com/profile.php?id=61595143955478&sk=followers',
            text: { text: '7 followers' },
          },
        ],
      },
      timeline_list_feed_units: { edges: [] },
    }
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { Location: 'https://www.facebook.com/people/Steve-Rossiter/61595143955478/' },
        }),
      )
      .mockResolvedValueOnce(new Response(html(profile)))
    vi.stubGlobal('fetch', request)
    const account = item('https://www.facebook.com/profile.php?id=61595143955478'),
      budget = vi.fn(async () => {})
    expect((await publicPage(account, budget)).metrics).toMatchObject({ followers: 7 })
    expect(budget).toHaveBeenCalledTimes(2)
    expect(String(request.mock.calls[1][0])).toBe(
      'https://www.facebook.com/people/Steve-Rossiter/61595143955478/',
    )
    request.mockImplementation(async () => new Response(html(profile)))
    expect((await publicDiscovery(account)).rows).toEqual([])
    expect(() =>
      publicProfile(
        item('https://www.facebook.com/profile.php?id=111'),
        embeddedObjects(html(profile)),
      ),
    ).toThrow('did not expose')
  })
  it('discovers only Facebook posts by the requested profile and refreshes matched video IDs', async () => {
    const data = {
      id: '61595143955478',
      timeline_list_feed_units: {
        edges: [
          {
            node: {
              post_id: 'pfbidTEST',
              actors: [{ id: '61595143955478' }],
              description: 'Coaching',
              like_count: 3,
              comment_count: 1,
            },
          },
          {
            node: {
              post_id: 'pfbidOTHER',
              actors: [{ id: '123' }],
              description: 'Visitor post',
              like_count: 999,
            },
          },
        ],
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(html(data))),
    )
    expect(
      (
        await publicDiscovery(item('https://www.facebook.com/profile.php?id=61595143955478'))
      ).rows.map((row) => row.url),
    ).toEqual(['https://www.facebook.com/61595143955478/posts/pfbidTEST'])
    expect(
      publicVideo(item('https://www.facebook.com/watch/?v=12345'), [
        { video_id: '12345', view_count: 80, like_count: 5 },
      ]).metrics,
    ).toMatchObject({ views: 80, likes: 5 })
  })
  it('does not infer totals from comment lists or fabricate engagement with missing required counts', () => {
    expect(
      normalizeVideo('instagram', { code: 'TEST', comments: [{}, {}] }).metrics.comments,
    ).toBeNull()
    expect(
      engagement({ ...item('https://instagram.com/p/TEST/'), metrics: { likes: 50, views: 100 } }),
    ).toBeNull()
    expect(
      engagement({
        ...item('https://instagram.com/p/TEST/'),
        metrics: { likes: 50, views: 1000, comments: 10, shares: 5 },
      }),
    ).toBe(6.5)
  })
})

describe('tracking validation and imports', () => {
  it('canonicalizes all seven platforms and rejects credentials, lookalike hosts and nonpublic pages', () => {
    const urls = [
      'https://tiktok.com/@coach/video/123',
      'https://instagram.com/reel/TEST/',
      'https://youtu.be/abcdefghijk',
      'https://twitter.com/coach/status/123',
      'https://snapchat.com/spotlight/TEST',
      'https://threads.net/@coach/post/TEST',
      'https://facebook.com/reel/123',
    ]
    expect(urls.map((url) => parseAnalyticsUrl(url).platform)).toEqual([
      'tiktok',
      'instagram',
      'youtube',
      'x',
      'snapchat',
      'threads',
      'facebook',
    ])
    expect(parseAnalyticsUrl('https://instagram.com/reel/TEST/?igsh=tracker').url).toBe(
      'https://www.instagram.com/p/TEST/',
    )
    for (const url of [
      'http://instagram.com/coach/',
      'https://instagram.com.evil.test/coach/',
      'https://user:pass@instagram.com/coach/',
      'https://instagram.com:444/coach/',
      'https://instagram.com/accounts/login/',
      'https://127.0.0.1/coach/',
      'https://youtube.com/watch?v=bad',
    ])
      expect(() => parseAnalyticsUrl(url)).toThrow()
  })
  it('configures the four supplied profiles and canonicalizes Facebook aliases to one identity', () => {
    expect(
      coachingAnalyticsAccounts.map((account) => parseAnalyticsUrl(account.url).identity),
    ).toEqual([
      'instagram:steverossiter_',
      'tiktok:gymotheechalamet',
      'youtube:steverossiter_',
      'facebook:61595143955478',
    ])
    expect(
      parseAnalyticsUrl('https://www.facebook.com/people/Steve-Rossiter/61595143955478/'),
    ).toMatchObject({
      identity: 'facebook:61595143955478',
      url: 'https://www.facebook.com/profile.php?id=61595143955478',
    })
    for (const url of [
      'https://www.facebook.com/people/Steve-Rossiter/not-a-number/',
      'https://www.facebook.com/profile.php?id=not-a-number',
    ])
      expect(() => parseAnalyticsUrl(url)).toThrow()
  })
  it('rejects API connections and non-daily intervals and supports existing production-card IDs', () => {
    expect(
      analyticsActionSchema.safeParse({
        action: 'connect',
        platform: 'instagram',
        key: 'secret-value',
      }).success,
    ).toBe(false)
    expect(
      analyticsActionSchema.safeParse({
        action: 'settings',
        automatic: true,
        intervalHours: 6,
        dailyLimit: 100,
      }).success,
    ).toBe(false)
    expect(
      analyticsActionSchema.safeParse({
        action: 'settings',
        automatic: true,
        intervalHours: 24,
        dailyLimit: 100,
      }).success,
    ).toBe(true)
    expect(
      analyticsActionSchema.safeParse({
        action: 'add',
        kind: 'video',
        title: 'Test',
        url: 'https://instagram.com/p/TEST/',
        boardId: 'cm123productioncard',
      }).success,
    ).toBe(true)
    expect(
      analyticsActionSchema.safeParse({
        action: 'snapshot',
        id: item('https://instagram.com/p/TEST/').id,
        capturedAt: '2026-10-14T00:00:00Z',
        metrics: { views: -1 },
      }).success,
    ).toBe(false)
  })
  it('reads multiline CSV cells and protects exported spreadsheet cells from formula execution', () => {
    expect(parseCSV('url,title\r\n"https://example.test/a","One, two\nthree"\r\n')).toEqual([
      ['url', 'title'],
      ['https://example.test/a', 'One, two\nthree'],
    ])
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"')
    expect(csvCell('@coach')).toBe('"\'@coach"')
    expect(() => parseCSV('"unclosed')).toThrow('closing quote')
  })
})
