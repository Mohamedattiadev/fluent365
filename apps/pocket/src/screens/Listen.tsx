// Listen: recordings to play on the move. (Real audio files with background play come next: LibriVox
// audiobooks for the reading ladder and generated MP3s for the lessons.)
import { useEffect, useState } from "react";
import { CourseUnitView, LessonStepView } from "../components/Lessons";
import { Icon } from "../components/ui";
import { loadCourse, type Content } from "../lib/content";
import { useApp } from "../lib/store";
import type { Course } from "../lib/types";
import { navigate } from "../router";
import { Back } from "./Learn";

export function ListenScreen({ c, path }: { c: Content; path: string[] }) {
  const lessons = useApp((s) => s.lessons);
  const coursework = useApp((s) => s.coursework);
  const [tests, setTests] = useState<Course | null>(null);
  useEffect(() => { void loadCourse("ielts-listening-tests").then(setTests).catch(() => undefined); }, []);
  const [sub, a, b] = path;
  if (sub === "lesson" && a && b) return <div><Back to="/listen" /><LessonStepView c={c} lesson={Number(a)} step={Number(b)} onDone={() => navigate("/listen")} /></div>;
  if (sub === "test" && a) return <div><Back to="/listen" /><CourseUnitView courseId="ielts-listening-tests" unitId={a} onDone={() => navigate("/listen")} /></div>;

  const tracks = c.lessons.map((l) => ({ l, i: l.kinds.indexOf("listen") })).filter((x) => x.i >= 0);
  return (
    <div>
      <h1>Listen</h1>
      <p className="lede">Recordings with questions. They use your device's English voice.</p>
      <h2 className="section-title">Recordings</h2>
      <ul className="list">
        {tracks.map(({ l, i }) => (
          <li key={l.number}><button className="rowbtn" onClick={() => navigate(`/listen/lesson/${l.number}/${i}`)}>
            <Icon name={lessons[l.number]?.done.includes(i) ? "check" : "play"} />
            <span className="grow"><span style={{ display: "block" }}>{l.title}</span><span className="small muted">{l.level} · {l.topic}</span></span>
            <Icon name="chevron" size={20} />
          </button></li>
        ))}
      </ul>
      <h2 className="section-title">IELTS listening practice</h2>
      <ul className="list">
        {(tests?.units ?? []).map((u) => (
          <li key={u.id}><button className="rowbtn" onClick={() => navigate(`/listen/test/${u.id}`)}>
            <Icon name={coursework[`ielts-listening-tests/${u.id}`]?.done ? "check" : "timer"} />
            <span className="grow"><span style={{ display: "block" }}>{u.title}</span><span className="small muted">{u.goal}</span></span>
            <Icon name="chevron" size={20} />
          </button></li>
        ))}
      </ul>
      <p className="small muted">Practice scores only, not official IELTS results.</p>
    </div>
  );
}
