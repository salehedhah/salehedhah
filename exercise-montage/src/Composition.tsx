import { Composition } from "remotion";
import { BackgroundVideo } from "./components/BackgroundVideo";
import { Captions } from "./components/Captions";
import { ProgressBar } from "./components/ProgressBar";

const FPS = 30;
const DURATION_IN_FRAMES = 288; // 9.6s source clip

export const MyComposition = () => {
  return (
    <Composition
      id="ExerciseMontage"
      component={ExerciseMontageVideo}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};

export const ExerciseMontageVideo: React.FC = () => {
  return (
    <>
      <BackgroundVideo />
      <Captions />
      <ProgressBar />
    </>
  );
};
