import { prisma } from "./prisma";

async function seedApps() {
  console.log("🌱 Seeding PPAApp registry...");

  await prisma.pPAApp.upsert({
    where: { slug: "pap-pad-app" },
    update: {},
    create: {
      name: "Pap-Pad-App",
      slug: "pap-pad-app",
      description: "Pi Network social prediction and Q&A platform",
      url: "https://ppa-prod.vercel.app",
      apiKey: "ppa_pap-pad-app_gnhopqpsbzimoc7ynfg",
      status: "ACTIVE",
      category: "PREDICTIONS",
    },
  });
  console.log("✅ PPA self-entry created");

  await prisma.pPAApp.upsert({
    where: { slug: "lopipo" },
    update: {},
    create: {
      name: "LoPiPo",
      slug: "lopipo",
      description: "Lottery, Pick, and Poll casino-style platform on Pi Network",
      url: "https://lopipo.app",
      apiKey: "ppa_lopipo_2c5078ecyl1moc80w1b",
      status: "ACTIVE",
      category: "GAMING",
    },
  });
  console.log("✅ LoPiPo entry created");

  console.log("🎉 PPAApp registry seeded!");
}

seedApps()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());