// Repeatable Quick Play modes. These are intentionally separate from the
// 36-mission journey and must not write to mission progress or badge state.
(function exposeJumviPlayModes(){
  "use strict";

  const text = (en, tr) => ({ en, tr });

  window.JUMVI_PLAY_MODES = [
    {
      id: "pop-and-stick",
      group: "solo",
      title: text("Pop & Stick", "At ve Yapıştır"),
      gear: { paddles: 1, balls: 1 },
      players: { min: 1, max: 1, label: text("1 player", "1 oyuncu") },
      seconds: 45,
      difficulty: text("Starter", "Başlangıç"),
      space: text("Small clear area", "Küçük ve boş bir alan"),
      steps: [
        text(
          "Slide one hand under the paddle strap. Hold the ball in your free hand.",
          "Bir elini paddle kayışının altına geçir. Topu boşta kalan elinde tut."
        ),
        text(
          "Pop the ball gently toward yourself, no higher than your forehead.",
          "Topu kendine doğru, alnından daha yükseğe çıkmayacak şekilde yumuşakça at."
        ),
        text(
          "Watch it all the way in, catch the middle, peel it off and repeat.",
          "Topu sonuna kadar izle, paddle'ın ortasında yakala, çıkar ve tekrarla."
        )
      ],
      goal: text(
        "Build your longest clean-catch streak in 45 seconds.",
        "45 saniyede art arda yaptığın en uzun temiz yakalama serisini oluştur."
      ),
      safety: text(
        "The strap stays on the playing hand only—snug, never tight. Use a soft self-toss and keep the ball away from faces.",
        "Kayış yalnızca oynayan elde, rahat ama sıkmayacak şekilde dursun. Topu kendine yumuşakça at ve yüzlerden uzak tut."
      ),
      voice: {
        intro: text(
          "Ball in your free hand. Soft pop, eyes on the ball, catch the middle. Three, two, one.",
          "Top boşta kalan elinde. Yumuşakça at, gözün topta olsun, ortada yakala. Üç, iki, bir."
        ),
        mid: {
          at: 20,
          text: text(
            "Soft pop. Still paddle. Watch it all the way in.",
            "Yumuşak at. Paddle sakin. Topu sonuna kadar izle."
          )
        },
        final: {
          remaining: 10,
          text: text(
            "Ten seconds. Smooth beats speed.",
            "On saniye. Hızdan önce kontrollü hareket."
          )
        },
        orchestrated: false,
        orchestratedCues: []
      }
    },
    {
      id: "quick-drop",
      group: "solo",
      title: text("Quick Drop", "Hızlı Bırak"),
      gear: { paddles: 1, balls: 1 },
      players: { min: 1, max: 1, label: text("1 player", "1 oyuncu") },
      seconds: 45,
      difficulty: text("Some practice", "Biraz pratik"),
      space: text("Small clear area", "Küçük ve boş bir alan"),
      steps: [
        text(
          "Hold the ball at shoulder height, in front of your body.",
          "Topu vücudunun önünde, omuz hizasında tut."
        ),
        text(
          "Let it go straight down—do not throw it.",
          "Topu dümdüz aşağı bırak; fırlatma."
        ),
        text(
          "Keep your feet still and slide the paddle under the ball to catch it.",
          "Ayakların sabitken paddle'ı topun altına getirip yakala."
        )
      ],
      goal: text(
        "Count your clean drop-catches. Try for 8, then beat your best.",
        "Temiz bırak-yakala sayını tut. Önce 8'i dene, sonra kendi rekorunu geç."
      ),
      safety: text(
        "The strap stays on the playing hand only. Drop the ball in front of you; do not dive, lunge or chase it.",
        "Kayış yalnızca oynayan elde kalsın. Topu önüne bırak; topa doğru atlama, uzanma veya peşinden koşma."
      ),
      voice: {
        intro: text(
          "Hold at shoulder height. Let go—don't throw. Slide the paddle under. Keep your feet still.",
          "Omuz hizasında tut. Atma, yalnızca bırak. Paddle'ı altına getir. Ayakların sabit kalsın."
        ),
        mid: {
          at: 20,
          text: text(
            "Drop in front. Paddle under. No diving.",
            "Önüne bırak. Paddle altta. Topa doğru atlama."
          )
        },
        final: {
          remaining: 10,
          text: text("Calm and quick.", "Sakin ve çabuk ol." )
        },
        orchestrated: false,
        orchestratedCues: []
      }
    },
    {
      id: "floor-target-four",
      group: "solo",
      title: text("Floor Target Four", "Yerde Dört Atış"),
      gear: { paddles: 1, balls: 4 },
      players: { min: 1, max: 1, label: text("1 player", "1 oyuncu") },
      seconds: 40,
      difficulty: text("Starter", "Başlangıç"),
      space: text("Clear floor space", "Boş ve düz bir zemin"),
      steps: [
        text(
          "Lay the paddle loose on a clean, dry, flat floor with the catching side facing up.",
          "Paddle'ı yakalama yüzü yukarı bakacak şekilde temiz, kuru ve düz zemine serbestçe koy."
        ),
        text(
          "Take two little steps back with all four balls beside you.",
          "Dört topu yanına al ve iki küçük adım geri çık."
        ),
        text(
          "Toss each ball softly underhand toward the middle. When all four are done, walk in to collect them.",
          "Her topu sırayla, alttan ve yumuşakça paddle'ın ortasına at. Dördü de bitince yürüyerek gidip topla."
        )
      ],
      goal: text(
        "Stick 3 of 4 balls. Next round, move back only half a step.",
        "4 topun 3'ünü yapıştır. Sonraki turda yalnızca yarım adım geri çık."
      ),
      safety: text(
        "Never tie, tape or fasten the paddle or strap to a wall, tree, furniture or fixture. Clear breakables, toss underhand and walk to collect the balls.",
        "Paddle'ı veya kayışı duvara, ağaca, mobilyaya ya da başka bir yere bağlama veya bantlama. Kırılabilir eşyaları kaldır, alttan at ve topları almaya yürüyerek git."
      ),
      voice: {
        intro: text(
          "Paddle on the floor. Two little steps back. Four soft underhand tosses—never hard or overhead.",
          "Paddle yerde. İki küçük adım geri. Dört yumuşak alttan atış; sert ya da baş üstünden atma."
        ),
        mid: {
          at: 16,
          text: text(
            "One soft toss at a time. Aim for the middle.",
            "Her seferinde tek ve yumuşak atış. Ortayı hedefle."
          )
        },
        final: {
          remaining: 5,
          text: text(
            "All done. Walk in and collect the balls.",
            "Bitti. Yürüyerek gidip topları al."
          )
        },
        orchestrated: true,
        orchestratedCues: [
          { at: 5, text: text("Ball one.", "Birinci top.") },
          { at: 12, text: text("Ball two.", "İkinci top.") },
          { at: 21, text: text("Ball three.", "Üçüncü top.") },
          { at: 28, text: text("Ball four.", "Dördüncü top.") }
        ]
      }
    },
    {
      id: "free-rally",
      group: "duo",
      title: text("Free Rally", "Serbest Paslaşma"),
      gear: { paddles: 2, balls: 1 },
      players: { min: 2, max: 2, label: text("2 players", "2 oyuncu") },
      seconds: 60,
      difficulty: text("Starter", "Başlangıç"),
      space: text("Small clear area", "Küçük ve boş bir alan"),
      steps: [
        text(
          "Face each other two little steps apart, one paddle each.",
          "Birer paddle takıp iki küçük adım arayla karşılıklı durun."
        ),
        text(
          "Toss softly underhand toward the middle of your partner's paddle.",
          "Topu partnerinin paddle'ının ortasına doğru alttan ve yumuşakça at."
        ),
        text(
          "Catch, peel and send it back. After two misses, both take one step closer.",
          "Yakala, topu çıkar ve geri gönder. İki kez kaçırırsanız ikiniz de bir adım yaklaşın."
        )
      ],
      goal: text(
        "Build your longest rally, then try to beat it.",
        "En uzun paslaşma serinizi yapın, sonra onu geçmeyi deneyin."
      ),
      safety: text(
        "Straps stay on the playing hands only. Use soft underhand tosses below forehead height and never aim at a face.",
        "Kayışlar yalnızca oynayan ellerde kalsın. Alın hizasının altında, alttan ve yumuşak atın; asla yüze nişan almayın."
      ),
      voice: {
        intro: text(
          "Soft toss to the middle. Catch, peel, send it back. Build your best rally.",
          "Ortaya yumuşak at. Yakala, çıkar, geri gönder. En iyi paslaşma serinizi yapın."
        ),
        mid: {
          at: 25,
          text: text(
            "Not sticking? Move one step closer, soften the toss and hold the paddle still.",
            "Yapışmıyor mu? Bir adım yaklaşın, daha yumuşak atın ve paddle'ı sakin tutun."
          )
        },
        final: {
          remaining: 10,
          text: text("Ten seconds. One smooth rally.", "On saniye. Tek ve kontrollü bir paslaşma.")
        },
        orchestrated: false,
        orchestratedCues: []
      }
    },
    {
      id: "copycat-pops",
      group: "duo",
      title: text("Copycat Pops", "Beni Taklit Et"),
      gear: { paddles: 2, balls: 2 },
      players: { min: 2, max: 2, label: text("2 players", "2 oyuncu") },
      seconds: 60,
      difficulty: text("Starter", "Başlangıç"),
      space: text("Small clear area", "Küçük ve boş bir alan"),
      steps: [
        text(
          "Stand side by side with an arm's space between you. Take one paddle and one ball each.",
          "Aranızda bir kol mesafesi bırakarak yan yana durun. Herkes bir paddle ve bir top alsın."
        ),
        text(
          "The leader makes one low, soft self-toss and catch. The partner copies it.",
          "Lider kendine alçak ve yumuşak bir atış yapıp yakalasın. Partneri aynı hareketi taklit etsin."
        ),
        text(
          "After five rounds, switch leaders and keep matching the same height.",
          "Beş turdan sonra lideri değiştirin ve aynı yüksekliği yakalamaya devam edin."
        )
      ],
      goal: text(
        "Make 10 matched catches where both balls stick.",
        "İki topun da yapıştığı 10 eşleşmiş yakalama yapın."
      ),
      safety: text(
        "Straps stay on the playing hands only. Keep both self-tosses below forehead height and leave space between players.",
        "Kayışlar yalnızca oynayan ellerde kalsın. İki atışı da alın hizasının altında tutun ve oyuncular arasında boşluk bırakın."
      ),
      voice: {
        intro: text(
          "Leader pops. Partner copies. Keep every toss below forehead height. Match the height, then catch.",
          "Lider atar, partner taklit eder. Her atış alın hizasının altında kalsın. Yüksekliği eşleştir, sonra yakala."
        ),
        mid: {
          at: 30,
          text: text("Switch leaders.", "Lideri değiştirin.")
        },
        final: {
          remaining: 10,
          text: text(
            "Match the height. Match the soft toss.",
            "Aynı yüksekliği ve aynı yumuşak atışı yakalayın."
          )
        },
        orchestrated: false,
        orchestratedCues: []
      }
    },
    {
      id: "four-ball-round",
      group: "duo",
      title: text("Four-Ball Round", "Dört Top Turu"),
      gear: { paddles: 2, balls: 4 },
      players: { min: 2, max: 2, label: text("2 players", "2 oyuncu") },
      seconds: 70,
      difficulty: text("Some practice", "Biraz pratik"),
      space: text("Small clear area", "Küçük ve boş bir alan"),
      steps: [
        text(
          "One player is the thrower and one is the catcher. Keep all four balls beside the thrower.",
          "Bir oyuncu atıcı, diğeri yakalayıcı olsun. Dört top da atıcının yanında dursun."
        ),
        text(
          "Send only one soft underhand toss at a time. Catch it, peel it off and place it beside you.",
          "Her seferinde yalnızca bir topu alttan ve yumuşakça atın. Yakala, çıkar ve yanına bırak."
        ),
        text(
          "After all four balls, switch thrower and catcher for four more tosses.",
          "Dört top bitince atıcıyla yakalayıcı yer değiştirsin ve dört atış daha yapın."
        )
      ],
      goal: text(
        "As a team, catch at least 6 of the 8 tosses.",
        "Takım olarak 8 atışın en az 6'sını yakalayın."
      ),
      safety: text(
        "Straps stay on the playing hands only. Keep one ball in the air at a time, toss below forehead height and walk to collect loose balls.",
        "Kayışlar yalnızca oynayan ellerde kalsın. Aynı anda yalnızca bir top havada olsun, alın hizasının altında atın ve kaçan topları yürüyerek alın."
      ),
      voice: {
        intro: text(
          "Four tosses each. One ball in the air at a time. Catch it, peel it, put it down.",
          "Herkes dört kez atsın. Aynı anda yalnızca bir top havada olsun. Yakala, çıkar, yere bırak."
        ),
        mid: {
          at: 34,
          text: text(
            "Switch thrower and catcher.",
            "Atıcıyla yakalayıcı yer değiştirsin."
          )
        },
        final: {
          remaining: 3,
          text: text("Round complete. Great teamwork.", "Tur tamamlandı. Harika takım oyunu.")
        },
        orchestrated: true,
        orchestratedCues: [
          { at: 5, text: text("Ball one.", "Birinci top.") },
          { at: 12, text: text("Ball two.", "İkinci top.") },
          { at: 19, text: text("Ball three.", "Üçüncü top.") },
          { at: 26, text: text("Ball four.", "Dördüncü top.") },
          { at: 42, text: text("Ball one.", "Birinci top.") },
          { at: 49, text: text("Ball two.", "İkinci top.") },
          { at: 56, text: text("Ball three.", "Üçüncü top.") },
          { at: 63, text: text("Ball four.", "Dördüncü top.") }
        ]
      }
    },
    {
      id: "sync-pop",
      group: "group",
      title: text("Sync Pop", "Aynı Anda Yakala"),
      gear: {
        paddles: 4,
        balls: 4,
        label: text("1 paddle + 1 ball per player", "Oyuncu başına 1 paddle + 1 top")
      },
      players: { min: 3, max: 4, label: text("3–4 players", "3–4 oyuncu") },
      seconds: 50,
      difficulty: text("Starter", "Başlangıç"),
      space: text("Clear circle space", "Boş bir çember alanı"),
      steps: [
        text(
          "Make a wide circle. Each player takes one paddle and one ball; with three players, leave the spare set aside.",
          "Geniş bir çember oluşturun. Her oyuncu bir paddle ve bir top alsın; üç kişiyseniz artan seti kenara koyun."
        ),
        text(
          "On POP, everyone makes one low, soft self-toss and catches their own ball.",
          "POP sesinde herkes kendi topunu alçak ve yumuşakça kendine atıp yakalasın."
        ),
        text(
          "If every ball sticks, score one team point. Peel, reset and wait for the next POP.",
          "Tüm toplar yapışırsa takım bir puan kazansın. Topları çıkarın, hazır olun ve sonraki POP sesini bekleyin."
        )
      ],
      goal: text(
        "Score 5 team points in 6 POP rounds.",
        "6 POP turunda 5 takım puanı kazanın."
      ),
      safety: text(
        "Straps stay on the playing hands only. Everyone tosses only their own ball, below forehead height, with plenty of space between players.",
        "Kayışlar yalnızca oynayan ellerde kalsın. Herkes yalnızca kendi topunu, alın hizasının altında atsın ve oyuncular arasında bolca boşluk olsun."
      ),
      voice: {
        intro: text(
          "One ball each. On POP, toss gently and catch your own ball. Wait for my call each time.",
          "Herkeste bir top. POP sesinde yumuşakça at ve kendi topunu yakala. Her turda komutumu bekle."
        ),
        mid: {
          at: 25,
          text: text(
            "Halfway. Make the next toss even softer.",
            "Yarıya geldik. Sıradaki atışı daha da yumuşak yapın."
          )
        },
        final: {
          remaining: 3,
          text: text("Round complete. Count your team points.", "Tur tamamlandı. Takım puanlarınızı sayın.")
        },
        orchestrated: true,
        orchestratedCues: [
          { at: 6, text: text("Ready... POP!", "Hazır... POP!") },
          { at: 13, text: text("Ready... POP!", "Hazır... POP!") },
          { at: 20, text: text("Ready... POP!", "Hazır... POP!") },
          { at: 29, text: text("Ready... POP!", "Hazır... POP!") },
          { at: 36, text: text("Ready... POP!", "Hazır... POP!") },
          { at: 44, text: text("Last one... POP!", "Son tur... POP!") }
        ]
      }
    },
    {
      id: "loop-rally",
      group: "group",
      title: text("Loop Rally", "Çember Pası"),
      gear: {
        paddles: 4,
        balls: 1,
        label: text("1 paddle per player + 1 ball total", "Oyuncu başına 1 paddle + toplam 1 top")
      },
      players: { min: 3, max: 4, label: text("3–4 players", "3–4 oyuncu") },
      seconds: 90,
      difficulty: text("Some practice", "Biraz pratik"),
      space: text("Wide clear circle", "Geniş ve boş bir çember"),
      steps: [
        text(
          "Make a wide triangle or square, leaving the middle empty. With three players, set the spare paddle aside.",
          "Ortası boş kalacak şekilde geniş bir üçgen veya kare oluşturun. Üç kişiyseniz artan paddle'ı kenara koyun."
        ),
        text(
          "Move one ball around the shape, one player at a time. Say the next player's name before each soft toss.",
          "Tek topu her seferinde bir sonraki oyuncuya atarak şeklin çevresinde dolaştırın. Yumuşakça atmadan önce sıradaki oyuncunun adını söyleyin."
        ),
        text(
          "When you hear REVERSE, send the ball around the other way.",
          "TERS YÖN komutunu duyunca topu diğer yönde dolaştırın."
        )
      ],
      goal: text(
        "Complete two full loops in each direction.",
        "Her iki yönde de ikişer tam tur tamamlayın."
      ),
      safety: text(
        "Straps stay on the playing hands only. Keep the middle clear, use one ball only, toss below forehead height and never cross the circle.",
        "Kayışlar yalnızca oynayan ellerde kalsın. Ortayı boş bırakın, yalnızca bir top kullanın, alın hizasının altında atın ve çemberin ortasından geçmeyin."
      ),
      voice: {
        intro: text(
          "Send one ball around the shape. Say the next name before you toss. Keep the middle clear.",
          "Tek topu şeklin çevresinde dolaştırın. Atmadan önce sıradaki kişinin adını söyleyin. Orta alan boş kalsın."
        ),
        mid: {
          at: 45,
          text: text(
            "Reverse! Send it the other way.",
            "Ters yön! Şimdi topu diğer yönde dolaştırın."
          )
        },
        final: {
          remaining: 15,
          text: text(
            "Final loop. Soft tosses, ready paddles.",
            "Son tur. Yumuşak atışlar, hazır paddle'lar."
          )
        },
        orchestrated: false,
        orchestratedCues: []
      }
    },
    {
      id: "twin-lane-rally",
      group: "group",
      title: text("Twin Lane Rally", "Çift Şerit Pası"),
      gear: { paddles: 4, balls: 2 },
      players: { min: 4, max: 4, label: text("4 players", "4 oyuncu") },
      seconds: 60,
      difficulty: text("Active", "Hareketli"),
      space: text("Two wide clear lanes", "İki geniş ve boş şerit"),
      steps: [
        text(
          "Make two pairs and set up two parallel play lanes with a wide gap between them.",
          "İki çift oluşturun ve aralarında geniş boşluk bulunan iki paralel oyun şeridi kurun."
        ),
        text(
          "Each pair rallies with its own ball, using soft underhand tosses inside its lane.",
          "Her çift kendi topuyla, kendi şeridinde alttan ve yumuşak atışlarla paslaşsın."
        ),
        text(
          "If a ball gets loose, everyone freezes. Walk to collect it, return to your lane, then restart together.",
          "Bir top kaçarsa herkes donsun. Topu yürüyerek alın, şeridinize dönün ve birlikte yeniden başlayın."
        )
      ],
      goal: text(
        "Add both lanes together and reach 20 team catches.",
        "İki şeridin yakalamalarını toplayarak takımca 20'ye ulaşın."
      ),
      safety: text(
        "Straps stay on the playing hands only. Stay in your lane, never throw across lanes and freeze before anyone collects a loose ball.",
        "Kayışlar yalnızca oynayan ellerde kalsın. Kendi şeridinizde kalın, diğer şeride top atmayın ve kaçan top alınmadan önce herkes donsun."
      ),
      voice: {
        intro: text(
          "Two pairs, two clear lanes, one ball in each lane. Every catch builds one team score.",
          "İki çift, iki boş şerit ve her şeritte bir top. Her yakalama takım puanına eklenir."
        ),
        mid: {
          at: 30,
          text: text(
            "Stay in your lane. If a ball drops, freeze while it is collected.",
            "Şeridinizde kalın. Top düşerse alınana kadar herkes donsun."
          )
        },
        final: {
          remaining: 10,
          text: text("Ten seconds. Both lanes together.", "On saniye. İki şerit birlikte.")
        },
        orchestrated: false,
        orchestratedCues: []
      }
    }
  ];
})();
