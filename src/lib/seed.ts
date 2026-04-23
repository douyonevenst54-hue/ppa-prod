import { prisma } from "./prisma";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create a system user for seeded content
  const systemUser = await prisma.user.upsert({
    where: { piUserId: "system_seed" },
    update: {},
    create: {
      piUserId: "system_seed",
      username: "PPA_Official",
      ppaBalance: 10000,
      tier: "ELITE",
      accuracyRate: 0.85,
      reputationScore: 9.5,
      streakDays: 30,
    },
  });

  console.log("✅ System user created:", systemUser.username);

  // Seed Predictions
  const predictions = [
    {
      title: "Will ETH surpass $4,000 by Friday?",
      category: "FINANCE" as const,
      daysFromNow: 3,
    },
    {
      title: "Will the Lakers make the playoffs this season?",
      category: "SPORTS" as const,
      daysFromNow: 9,
    },
    {
      title: "Will Apple release an AI device in 2026?",
      category: "TECH" as const,
      daysFromNow: 40,
    },
    {
      title: "Will Bitcoin hit $100K before June?",
      category: "FINANCE" as const,
      daysFromNow: 40,
    },
    {
      title: "Will a major country ban TikTok in 2026?",
      category: "POLITICS" as const,
      daysFromNow: 60,
    },
  ];

  for (const p of predictions) {
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + p.daysFromNow);
    await prisma.content.upsert({
      where: { id: `seed_pred_${p.title.slice(0, 10)}` },
      update: {},
      create: {
        id: `seed_pred_${p.title.slice(0, 10).replace(/\s+/g, '_')}`,
        creatorId: systemUser.id,
        title: p.title,
        category: p.category,
        type: "prediction",
        status: "ACTIVE",
        endsAt,
        participantCount: Math.floor(Math.random() * 500) + 50,
      },
    });
  }

  console.log("✅ Predictions seeded");

  // Seed Polls
  const polls = [
    {
      title: "Which crypto will outperform in Q2 2026?",
      category: "FINANCE" as const,
      options: ["Bitcoin", "Ethereum", "Solana", "BNB"],
      daysFromNow: 7,
    },
    {
      title: "Best sport to predict outcomes in?",
      category: "SPORTS" as const,
      options: ["Football", "Basketball", "Tennis", "MMA"],
      daysFromNow: 9,
    },
    {
      title: "Will AI replace most jobs by 2030?",
      category: "TECH" as const,
      options: ["Definitely Yes", "Probably Yes", "Probably No", "Definitely No"],
      daysFromNow: 10,
    },
    {
      title: "Which Pi app will dominate in 2026?",
      category: "SOCIAL" as const,
      options: ["PPA", "LoPiPo", "Pi Browser", "Other"],
      daysFromNow: 24,
    },
  ];

  for (const p of polls) {
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + p.daysFromNow);
    await prisma.content.upsert({
      where: { id: `seed_poll_${p.title.slice(0, 10)}` },
      update: {},
      create: {
        id: `seed_poll_${p.title.slice(0, 10).replace(/\s+/g, '_')}`,
        creatorId: systemUser.id,
        title: p.title,
        category: p.category,
        type: "poll",
        status: "ACTIVE",
        endsAt,
        participantCount: Math.floor(Math.random() * 1000) + 100,
        pollOptions: {
          create: p.options.map(text => ({ text })),
        },
      },
    });
  }

  console.log("✅ Polls seeded");

  // Seed Challenges
  const challenges = [
    {
      title: "Daily Quiz",
      category: "GENERAL" as const,
      difficulty: "MEDIUM" as const,
      questions: [
        {
          text: "What is the largest cryptocurrency by market cap?",
          options: ["Ethereum", "Bitcoin", "Solana", "BNB"],
          correctAnswer: "Bitcoin",
        },
        {
          text: "What does 'DeFi' stand for?",
          options: ["Digital Finance", "Decentralized Finance", "Defined Fiat", "Direct Funding"],
          correctAnswer: "Decentralized Finance",
        },
        {
          text: "Which consensus mechanism does Ethereum use after The Merge?",
          options: ["Proof of Work", "Proof of Stake", "Proof of History", "Delegated PoS"],
          correctAnswer: "Proof of Stake",
        },
        {
          text: "What is a 'gas fee' in blockchain?",
          options: ["A mining tax", "Transaction processing cost", "Exchange fee", "Wallet fee"],
          correctAnswer: "Transaction processing cost",
        },
        {
          text: "What year was Bitcoin created?",
          options: ["2007", "2008", "2009", "2010"],
          correctAnswer: "2009",
        },
      ],
    },
    {
      title: "Sports Blitz",
      category: "SPORTS" as const,
      difficulty: "EASY" as const,
      questions: [
        {
          text: "How many players are on a basketball team on the court?",
          options: ["4", "5", "6", "7"],
          correctAnswer: "5",
        },
        {
          text: "Which country won the 2022 FIFA World Cup?",
          options: ["France", "Brazil", "Argentina", "Germany"],
          correctAnswer: "Argentina",
        },
        {
          text: "How many sets are in a standard tennis match for men?",
          options: ["3", "5", "4", "2"],
          correctAnswer: "5",
        },
        {
          text: "What sport is played at Wimbledon?",
          options: ["Golf", "Cricket", "Tennis", "Polo"],
          correctAnswer: "Tennis",
        },
        {
          text: "How long is an NBA game in minutes?",
          options: ["40", "48", "60", "36"],
          correctAnswer: "48",
        },
      ],
    },
    {
      title: "Tech IQ",
      category: "TECH" as const,
      difficulty: "HARD" as const,
      questions: [
        {
          text: "What does API stand for?",
          options: ["App Programming Interface", "Application Programming Interface", "Applied Protocol Interface", "Automated Program Integration"],
          correctAnswer: "Application Programming Interface",
        },
        {
          text: "Which language is primarily used for smart contracts on Ethereum?",
          options: ["Python", "JavaScript", "Solidity", "Rust"],
          correctAnswer: "Solidity",
        },
        {
          text: "What is the time complexity of binary search?",
          options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
          correctAnswer: "O(log n)",
        },
        {
          text: "What does SQL stand for?",
          options: ["Structured Query Language", "Simple Query Logic", "Standard Question Language", "System Query Layer"],
          correctAnswer: "Structured Query Language",
        },
        {
          text: "Which company created the TypeScript language?",
          options: ["Google", "Meta", "Microsoft", "Apple"],
          correctAnswer: "Microsoft",
        },
      ],
    },
  ];

  for (const c of challenges) {
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + 365);
    await prisma.content.upsert({
      where: { id: `seed_chal_${c.title.slice(0, 10)}` },
      update: {},
      create: {
        id: `seed_chal_${c.title.slice(0, 10).replace(/\s+/g, '_')}`,
        creatorId: systemUser.id,
        title: c.title,
        category: c.category,
        type: "challenge",
        status: "ACTIVE",
        endsAt,
        questions: {
          create: c.questions.map(q => ({
            text: q.text,
            options: q.options,
            correctAnswer: q.correctAnswer,
            category: c.category,
            difficulty: c.difficulty,
            qualityScore: 8,
          })),
        },
      },
    });
  }

  console.log("✅ Challenges seeded");
  console.log("🎉 Database seeded successfully!");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());