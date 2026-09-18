import { Composition, Sequence } from "remotion";
import { Background } from "./components/Background";
import { VideoCard } from "./components/VideoCard";
import { Caption } from "./components/Caption";
import { KaratBadge } from "./components/KaratBadge";

type Beat = {
  from: number;
  duration: number;
  light: string;
  bold: string;
  karat?: string;
};

const beats: Beat[] = [
  { from: 0, duration: 48, light: "الذهب", bold: "ثلاثة أنواع" },
  { from: 48, duration: 51, light: "ذهب عيار", bold: "21", karat: "21" },
  { from: 99, duration: 51, light: "ذهب عيار", bold: "18", karat: "18" },
  { from: 150, duration: 48, light: "ذهب عيار", bold: "22", karat: "22" },
  { from: 198, duration: 42, light: "ذهب عيار", bold: "24", karat: "24" },
  { from: 240, duration: 55, light: "وش الكويس", bold: "ووش الي مو كويس" },
];

const TOTAL_DURATION = beats.reduce((sum, b) => sum + b.duration, 0);

export const MyComposition = () => {
  return (
    <Composition
      id="GoldKarats"
      component={GoldKaratsVideo}
      durationInFrames={TOTAL_DURATION}
      fps={30}
      width={720}
      height={1280}
    />
  );
};

export const GoldKaratsVideo: React.FC = () => {
  return (
    <>
      <Background />
      <VideoCard />
      {beats.map((beat, i) => (
        <Sequence
          key={i}
          from={beat.from}
          durationInFrames={beat.duration}
          layout="none"
        >
          <Caption
            light={beat.light}
            bold={beat.bold}
            durationInFrames={beat.duration}
          />
          {beat.karat && (
            <KaratBadge karat={beat.karat} durationInFrames={beat.duration} />
          )}
        </Sequence>
      ))}
    </>
  );
};
