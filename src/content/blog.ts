// Preserve submitted wording; blocks describe only the reading layout.
export type BlogBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'separator'; text: string }
  | { type: 'quote'; paragraphs: string[]; author?: string; authorPosition?: 'before' | 'after' }

export type BlogPost = {
  slug: string
  title: string
  author: string
  excerpt: string
  featuredQuote: string
  quoteAuthor?: string
  body: BlogBlock[]
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'alan-watts-life-is-not-a-journey',
    title: 'Life is Not a Journey',
    author: 'Steve Rossiter',
    excerpt:
      'I often think of this Alan Watts analogy before my sets. It helps me lock in, stay present, and focus on quality reps.',
    featuredQuote: 'The whole point of the dancing is the dance!',
    quoteAuthor: 'Alan Watts',
    body: [
      {
        type: 'paragraph',
        text: 'I often think of this Alan Watts analogy before my sets. It helps me lock in, stay present, and focus on quality reps. The point of a set isn’t to get to the end of the set. It’s to live in the set, enjoy it, and make the most of it.',
      },
      {
        type: 'paragraph',
        text: 'A lot of my new clients or those who just go through the motions tend to rush through their reps to get to the end of the set. So I share this analogy. They roll their eyes. Eventually it clicks and they understand.',
      },
      {
        type: 'separator',
        text: '. . . . . . . . . .',
      },
      {
        type: 'quote',
        paragraphs: [
          "“Existence—the physical universe—is basically playful. There is no necessity for it whatsoever. It isn't going anywhere… that is to say, it doesn't have some destination that it ought to arrive at.",
          "But, it is best understood by analogy with music. Because music, as an art form, is essentially playful. We say you play the piano. You don't work the piano. Why? Music differs from, say, travel. When you travel, you are trying to get somewhere. One doesn't make the end of the composition the point of the composition. If that were so, the best conductors would be those who played fastest. And there would be composers who wrote only finales. People would go to concerts just to hear one cracking chord, 'cause that's the end.",
          "Same when dancing… you don't aim at a particular spot in the room, that's where you should arrive. The whole point of the dancing is the dance! Now, but we don't see that as something brought by our education into our everyday conduct. We've got a system of schooling, which gives a completely different impression. It's all graded. And what we do is we put the child into the corridor, of this grade system, with a kind of \"Come on, kitty kitty kitty\" and now, you go to kindergarten, you know, and that's a great thing because when you finish that you get into first grade. And then, come on, first grade leads to second grade and so on and then you get out of grade school and you go to high school, and it's revving up - the thing is coming! And then you're gonna go to college and then you'll get into graduate school, and when you're through with graduate school you'll go out to join the world. And then you'll get into some racket, where you're selling insurance. And they've got that quota to make. And you're gonna make that. And all the time that thing is coming, it's coming, it's coming, that great thing— the success you're working for.",
          "Then, when you wake up one day about forty years old, you say, \"My God, I've arrived. I'm there!\" And you don't feel very different from what you always felt. By expectation, look at the people who live to retire and put those savings away. And then, when they're 65, they don't have any energy left, they're more or less impotent and uh, they go and rot in an old people's \"senior citizen's community.”",
          'Because we simply cheated ourselves the whole way down the line.',
          "We thought of life by analogy with a journey with a pilgrimage, which had a serious purpose at the end, and the thing was to get to that end. Success, or whatever it is, or maybe Heaven after you're dead. But, we missed the point the whole way along. It was a musical thing, and you were supposed to sing, or to dance, while the music was being played.”",
        ],
        author: 'Alan Watts',
        authorPosition: 'before',
      },
    ],
  },
  {
    slug: 'stop-racing',
    title: 'Stop Racing',
    author: 'Steve Rossiter',
    excerpt:
      'Instead of, “How do I get healthy & fit in 90 days?!” or, “How do I get a six-pack by summer?!” ask yourself…',
    featuredQuote: 'The day you stop racing is the day you win the race.',
    quoteAuthor: 'Bob Marley',
    body: [
      {
        type: 'paragraph',
        text: 'Instead of, “How do I get healthy & fit in 90 days?!” or, “How do I get a six-pack by summer?!” ask yourself…',
      },
      {
        type: 'list',
        items: [
          '“How can I be healthy, well, & fit for the rest of my life?”',
          '“What can I do for the rest of my life and actually enjoy doing?”',
          '“How can I eat for the rest of my life and actually enjoy eating?”',
        ],
      },
      {
        type: 'paragraph',
        text: 'Stop racing. There is no finish line. Health/wellness/fitness requires lifelong consistency. Let the results be a byproduct of your consistent efforts.',
      },
      {
        type: 'paragraph',
        text: 'If your everyday routine feels like a prison sentence that you can’t wait to finish, you’re doing it wrong.',
      },
      {
        type: 'paragraph',
        text: 'Slow down. Enjoy the process. Enjoy your life.',
      },
      {
        type: 'quote',
        paragraphs: ['"The day you stop racing is the day you win the race."'],
        author: 'Bob Marley',
      },
    ],
  },
  {
    slug: 'to-goal-or-not-to-goal',
    title: 'To Goal, or Not To Goal',
    author: 'Steve Rossiter',
    excerpt:
      'In April of 1958, Hunter Thompson wrote the following in response to a request for life advice.',
    featuredQuote: 'But beware of looking for goals: look for a way of life.',
    quoteAuthor: 'Hunter Thompson',
    body: [
      {
        type: 'paragraph',
        text: 'In April of 1958, Hunter Thompson wrote the following in response to a request for life advice.',
      },
      {
        type: 'quote',
        paragraphs: [
          '"But beware of looking for goals: look for a way of life. Decide how you want to live and then see what you can do to make a living WITHIN that way of life."',
        ],
      },
      {
        type: 'paragraph',
        text: 'While this was career advice, it’s applicable to your wellness plan.',
      },
      {
        type: 'paragraph',
        text: 'Do activities/workouts you actually enjoy rather than just using them to reach a goal. Let the results be a byproduct of a lifestyle you enjoy, your habits, and your consistent efforts.',
      },
      {
        type: 'paragraph',
        text: 'Are you enjoying your life? That is the question.',
      },
    ],
  },
  {
    slug: 'enjoy-the-ride',
    title: 'Enjoy the Ride',
    author: 'Steve Rossiter',
    excerpt:
      'I love this story from author & entrepreneur Derek Sivers. I’ve applied the lesson to my wellness plan and it’s made my life way more enjoyable.',
    featuredQuote:
      'All that huffing & puffing and stress for an extra two minutes. It was basically for nothing.',
    quoteAuthor: 'Derek Sivers',
    body: [
      {
        type: 'paragraph',
        text: 'I love this story from author & entrepreneur Derek Sivers. I’ve applied the lesson to my wellness plan and it’s made my life way more enjoyable.',
      },
      {
        type: 'paragraph',
        text: 'Derek got into cycling when he lived on the beach in Santa Monica. There’s a great bike path that goes for 25 miles in the sand. He would go onto the bike path, set his timer, put his head down, and push it as hard as he could.',
      },
      {
        type: 'paragraph',
        text: 'It was always 43 minutes. Over time, he noticed he was starting to feel less psyched about going out on the bike path. Mentally, it would feel like pain and hard work.',
      },
      {
        type: 'paragraph',
        text: 'He almost stopped riding altogether but instead said, “You know it’s not cool for me to start to associate negative stuff with going on the bike ride. Why don’t I just chill for once. I’m just going to go on the same bike ride. I’m not going to be a complete snail, but I’ll go at half of my normal pace.”',
      },
      {
        type: 'paragraph',
        text: 'So he went on the same bike ride but was standing up more and looked around more. He looked out and noticed there were dolphins jumping in the ocean.',
      },
      {
        type: 'paragraph',
        text: 'He had a great time. It was purely pleasant. No red face. No huffing & puffing. He was just cycling.',
      },
      {
        type: 'paragraph',
        text: 'When he got back to his usual stopping place, he looked at his watch and it said 45 minutes.',
      },
      {
        type: 'quote',
        paragraphs: [
          '“No way. How the hell that could have been 45 minutes as compared to my usual 43!? There’s no way.”',
        ],
      },
      {
        type: 'paragraph',
        text: 'Yes way… 45 minutes.',
      },
      {
        type: 'quote',
        paragraphs: [
          '“All that huffing & puffing and stress for an extra two minutes. It was basically for nothing.”',
        ],
      },
    ],
  },
  {
    slug: 'progress',
    title: 'Progress',
    author: 'Steve Rossiter',
    excerpt: 'How do you know if you’re making real progress on your wellness journey?',
    featuredQuote: 'Are you focused on progress rather than perfection?',
    body: [
      {
        type: 'paragraph',
        text: 'How do you know if you’re making real progress on your wellness journey?',
      },
      {
        type: 'paragraph',
        text: 'Well… are you kind to yourself? Forgiving? Compassionate?',
      },
      {
        type: 'paragraph',
        text: 'Are you focused on progress rather than perfection?',
      },
      {
        type: 'paragraph',
        text: 'It’s not about being jacked or having a six-pack.',
      },
      {
        type: 'paragraph',
        text: 'Yes those things are nice and (usually) a byproduct of your choices & healthy habits. And it’s all that younger me cared about. But it’s so much deeper (and yet simpler) for me now.',
      },
      {
        type: 'paragraph',
        text: 'Do I feel great? Am I good to myself? Am I at peace?',
      },
      {
        type: 'paragraph',
        text: "Answer yes to these questions first, then think about getting jacked (if you're not already jacked).",
      },
    ],
  },
  {
    slug: 'the-mexican-fisherman',
    title: 'The Mexican Fisherman',
    author: 'Steve Rossiter',
    excerpt:
      'The Mexican Fisherman is a variation of a short story originally told by Heinrich Böll. It’s about an encounter between an American investment banker and a Mexican fisherman…',
    featuredQuote: 'Don’t miss out on the life you have because of the life you seek.',
    body: [
      {
        type: 'paragraph',
        text: 'The Mexican Fisherman is a variation of a short story originally told by Heinrich Böll. It’s about an encounter between an American investment banker and a Mexican fisherman…',
      },
      {
        type: 'paragraph',
        text: 'An American investment banker was at the pier of a small coastal Mexican village when a small boat with just one fisherman docked. Inside the small boat were several large yellowfin tuna. The American complimented the Mexican on the quality of his fish and asked how long it took to catch them.',
      },
      {
        type: 'paragraph',
        text: 'The Mexican replied, “Only a little while.” The American then asked why didn’t he stay out longer and catch more fish? The Mexican said he had enough to support his family’s needs. The American then asked, “But what do you do with the rest of your time?”',
      },
      {
        type: 'paragraph',
        text: 'The Mexican fisherman said, “I sleep in, fish a little, play with my children, take siestas with my wife Maria, stroll into the village each evening where I sip wine and play guitar with my amigos. I have a full life.”',
      },
      {
        type: 'paragraph',
        text: 'The American scoffed, “I’m a Harvard MBA and could help you. You should spend more time fishing and, with the proceeds, buy a bigger boat. With the proceeds from the bigger boat, you could buy several boats, eventually you would have a fleet of fishing boats. Instead of selling your catch to a middleman you would sell directly to the processor, eventually opening your own cannery. You would control the product, processing, and distribution. You would need to leave this village and move to Mexico City, then LA, and eventually New York City, where you’ll run your expanding enterprise.”',
      },
      {
        type: 'paragraph',
        text: 'The Mexican fisherman asked, “But, how long will this all take?”',
      },
      {
        type: 'paragraph',
        text: 'To which the American replied, “15 – 20 years.”',
      },
      {
        type: 'paragraph',
        text: '“Then what?” Asked the Mexican.',
      },
      {
        type: 'paragraph',
        text: 'The American laughed and said, “That’s the best part. When the time is right you would announce an IPO and sell your company stock to the public and become very rich— you would make millions!”',
      },
      {
        type: 'quote',
        paragraphs: ['“Then what?”'],
      },
      {
        type: 'paragraph',
        text: 'The American said, “Then you could retire. Move to a small coastal fishing village where you could sleep in, fish a little, play with your kids, take siestas with your wife, stroll to the village in the evenings where you could sip wine and play your guitar with your amigos.”',
      },
      {
        type: 'heading',
        text: 'The Mexican Fisherman and your health & fitness…',
      },
      {
        type: 'paragraph',
        text: 'Do you want to be an Olympian? A HYROX champion? Mr. Olympia? You’ll need to dedicate your life to your pursuit and sacrifice a lot.',
      },
      {
        type: 'paragraph',
        text: 'But if you just want to feel great and enjoy your life… it’s pretty simple and you can start right now.',
      },
      {
        type: 'paragraph',
        text: 'Ask yourself…',
      },
      {
        type: 'quote',
        paragraphs: ['“What do I want?” “What’s enough?”'],
      },
      {
        type: 'paragraph',
        text: 'Figure out what you want & why and pursue it for you. Get out of the rat race & off the hamster wheel. Slow down and simplify your life.',
      },
      {
        type: 'paragraph',
        text: 'I spun my wheels for years. Racing around but not getting anywhere. I was in the gym 6 days a week, punished myself with boring cardio, and stressed about my “diet.”',
      },
      {
        type: 'quote',
        paragraphs: ['“Then what?”'],
      },
      {
        type: 'paragraph',
        text: 'Well then, I thought, “I’ll be in phenomenal shape and can train less to maintain it and finally start enjoying my life.”',
      },
      {
        type: 'paragraph',
        text: 'I don’t need to be the biggest, strongest, most ripped, or “best” anything. Fool’s errands.',
      },
      {
        type: 'paragraph',
        text: 'Having a nice little body—inside & out—is enough for me.',
      },
      {
        type: 'paragraph',
        text: 'Don’t fall into the trap of chasing/wanting more for the sake of chasing/wanting more. Ask yourself, “Why?” Realize what’s enough for you. Anything else is a bonus and should come as a byproduct of a lifestyle you enjoy.',
      },
      {
        type: 'paragraph',
        text: 'Keep your wellness plan simple. Focus on quality over quantity. Don’t complicate things or add things for the sake of it. Wellness is as much about not doing bad things as it is doing good things.',
      },
      {
        type: 'paragraph',
        text: 'Don’t wait to enjoy your life. Don’t wait for the weekend, a vacation, the summer… find joy in your everyday life and in the so-called little things.',
      },
      {
        type: 'paragraph',
        text: 'Don’t wait to enjoy your nice little body, even if you’re just starting out. Show yourself love and tell yourself you have a nice little body right now (but don’t be delusional if you need to get your health in order).',
      },
      {
        type: 'paragraph',
        text: 'Don’t miss out on the life you have because of the life you seek. Don’t miss out on the body you have because of the body you seek.',
      },
      {
        type: 'paragraph',
        text: 'Simplify your life. Maybe you already have what you’re seeking.',
      },
      {
        type: 'paragraph',
        text: '. . . . . . . . . . \nThe American complimented the Mexican on the quality of his nice little body and asked how long it takes to get one.',
      },
      {
        type: 'paragraph',
        text: 'The Mexican replied, “Only a little while.” The American then asked why didn’t he train longer and harder? Then you’ll be bigger, stronger, and more ripped! The Mexican said he had enough to support his needs & wants. The American then asked, “But what do you do with the rest of your time?”',
      },
      {
        type: 'paragraph',
        text: 'The Mexican said, “I sleep in, fish a little, play with my children, take siestas with my wife, stroll into the village each evening where I sip tequila and play guitar with my amigos. I have a full, healthy life.”',
      },
    ],
  },
  {
    slug: 'walking-to-walk',
    title:
      '"The man who loves walking walks farther/further than the man who loves the destination."',
    author: 'Steve Rossiter',
    excerpt:
      'Walking is one of my favorite things. I love throwing on Gryffin’s Gravity album and being alone with my thoughts, or not thinking at all. I love walking with friends… unlocking the secrets of the Universe or gossiping.',
    featuredQuote:
      'Your wellness is an infinite game. Your goal should be to keep playing the game.',
    body: [
      {
        type: 'paragraph',
        text: 'Walking is one of my favorite things. I love throwing on Gryffin’s Gravity album and being alone with my thoughts, or not thinking at all. I love walking with friends… unlocking the secrets of the Universe or gossiping.',
      },
      {
        type: 'paragraph',
        text: 'For years I walked 10,000+ steps a day on average. Eventually, however, hitting 10,000 steps became a grind. I said to myself, “McConaughey, why are you stressing about hitting this arbitrary number?” So, cold turkey, I stopped counting and even deleted the step counter from my phone.',
      },
      {
        type: 'paragraph',
        text: 'My “destination” was 10,000 steps. I was so focused on getting to the number that I stopped enjoying my walks. When I got to 10,000 I usually stopped immediately.',
      },
      {
        type: 'paragraph',
        text: 'But now that I’m walking to walk, I’m enjoying it again. And… I usually end up walking close to, if not more than 10,000 without trying.',
      },
      {
        type: 'paragraph',
        text: 'The same is true for your wellness journey. When you embrace & enjoy the process you’ll go way farther and way further than if you’re focused on an outcome.',
      },
      {
        type: 'quote',
        paragraphs: ['“But, Steve, are you saying I shouldn’t have goals?”'],
      },
      {
        type: 'paragraph',
        text: 'Your wellness is an infinite game. Your goal should be to keep playing the game.',
      },
      {
        type: 'paragraph',
        text: 'If you walk because you love walking, you’ll hit goals along the way. And you’ll keep walking once you hit them.',
      },
      {
        type: 'paragraph',
        text: '[Insert thing] because you love [doing that thing]. Make it what you do. Make it who you are. You’ll go way farther and way further.',
      },
    ],
  },
]
