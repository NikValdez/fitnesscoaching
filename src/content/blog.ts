// Keep the submitted copy verbatim, including the spoken transcript's punctuation.
export const blogPosts = [
  {
    slug: 'alan-watts-life-is-not-a-journey',
    title: 'Alan Watts: Life is Not a Journey',
    author: 'Steve Rossiter',
    excerpt:
      'I often think of this Alan Watts analogy before & during my sets. It helps me lock in, stay present, and focus on quality reps.',
    featuredQuote: 'The whole point of the dancing is the dance!',
    separator: '. . . . . . . . . .',
    quoteAuthor: 'Alan Watts',
    intro: [
      'I often think of this Alan Watts analogy before & during my sets. It helps me lock in, stay present, and focus on quality reps. The point of a set isn’t to get to the end of the set. It’s to live in the set, enjoy it, and make the most of it.',
      'A lot of my newer clients or those who just go through the motions tend to rush through their reps to get to the end of the set. So I share this analogy. They roll their eyes. Eventually it clicks and they understand.',
    ],
    quote: [
      "“Existence—the physical universe—is basically playful. There is no necessity for it whatsoever. It isn't going anywhere… that is to say, it doesn't have some destination that it ought to arrive at.",
      "But, it is best understood by analogy with music. Because music, as an art form, is essentially playful. We say you play the piano. You don't work the piano. Why? Music differs from, say, travel. When you travel, you are trying to get somewhere. One doesn't make the end of the composition the point of the composition. If that were so, the best conductors would be those who played fastest. And there would be composers who wrote only finales. People would go to concerts just to hear one cracking chord, 'cause that's the end.",
      "Same when dancing… you don't aim at a particular spot in the room, that's where you should arrive. The whole point of the dancing is the dance! Now, but we don't see that as something brought by our education into our everyday conduct. We've got a system of schooling, which gives a completely different impression. It's all graded. And what we do is we put the child into the corridor, of this grade system, with a kind of \"Come on, kitty kitty kitty\" and now, you go to kindergarten, you know, and that's a great thing because when you finish that you get into first grade. And then, come on, first grade leads to second grade and so on and then you get out of grade school and you go to high school, and it's revving up - the thing is coming! And then you're gonna go to college and then you'll get into graduate school, and when you're through with graduate school you'll go out to join the world. And then you'll get into some racket, where you're selling insurance. And they've got that quota to make. And you're gonna make that. And all the time that thing is coming, it's coming, it's coming, that great thing— the success you're working for.",
      "Then, when you wake up one day about forty years old, you say, \"My God, I've arrived. I'm there!\" And you don't feel very different from what you always felt. By expectation, look at the people who live to retire and put those savings away. And then, when they're 65, they don't have any energy left, they're more or less impotent and uh, they go and rot in an old people's \"senior citizen's community.”",
      'Because we simply cheated ourselves the whole way down the line.',
      "We thought of life by analogy with a journey with a pilgrimage, which had a serious purpose at the end, and the thing was to get to that end. Success, or whatever it is, or maybe Heaven after you're dead. But, we missed the point the whole way along. It was a musical thing, and you were supposed to sing, or to dance, while the music was being played.”",
    ],
  },
]

export function blogReadingMinutes(post: (typeof blogPosts)[number]) {
  const words = [...post.intro, ...post.quote].join(' ').trim().split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
}
