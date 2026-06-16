import { cancelA2UPayment } from "./src/lib/pi-a2u";
cancelA2UPayment("uLmDX0FHHHzR2pjynnvS4KIBQGsF")
  .then((r) => console.log("Cancel result:", JSON.stringify(r, null, 2)))
  .catch((e) => console.error("Cancel error:", e));
