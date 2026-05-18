import { redirect } from "next/navigation";

export default function Home() {
  // Default to Search page
  redirect("/search");
}