import type { Metadata } from "next";
import { SynthLabApp } from "@/synth-lab/SynthLabApp";

export const metadata: Metadata = {
  title: "Synth Lab",
  description:
    "A four-track groovebox that teaches synthesis: make a small jam, then learn why it sounds that way while you make it."
};

export default function SynthLabPage() {
  return <SynthLabApp />;
}
