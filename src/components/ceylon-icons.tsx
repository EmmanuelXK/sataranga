import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { children?: ReactNode };

function Art({ children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.45}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Crossed Kastane swords. */
export function IconKastane(props: IconProps) {
  return (
    <Art {...props}>
      <path d="M5.2 19.2c2.4-1.4 5.2-5 9.2-10.2 1.5-1.9 3-3.2 4.4-4" />
      <path d="M4.4 20.2c.9-.3 1.7-1 2.2-1.8" />
      <path d="M3.6 17.4c1.5.3 2.6 1.1 3 2.4" />
      <path d="M17.6 4.2c.5.7.6 1.5.2 2.2" />
      <path d="M18.8 19.2c-2.4-1.4-5.2-5-9.2-10.2-1.5-1.9-3-3.2-4.4-4" />
      <path d="M19.6 20.2c-.9-.3-1.7-1-2.2-1.8" />
      <path d="M20.4 17.4c-1.5.3-2.6 1.1-3 2.4" />
      <path d="M6.4 4.2c-.5.7-.6 1.5-.2 2.2" />
    </Art>
  );
}

/** A globe ringed by sandakada pahana bands. */
export function IconMoonGlobe(props: IconProps) {
  return (
    <Art {...props}>
      <circle cx="12" cy="12" r="3.15" />
      <path d="M12 8.9c.9.9 1.35 1.8 1.35 3.1s-.45 2.2-1.35 3.1c-.9-.9-1.35-1.8-1.35-3.1s.45-2.2 1.35-3.1" />
      <path d="M9 12h6" />
      <circle cx="12" cy="12" r="6.15" />
      <circle cx="12" cy="12" r="8.7" />
    </Art>
  );
}

/** Kolam-mask face under a lotus crown. */
export function IconKolam(props: IconProps) {
  return (
    <Art {...props}>
      <path d="M12 2.2c.55 1.5.55 2.3 0 3.3-.55-1-.55-1.8 0-3.3" />
      <path d="M8.2 4.4c1.3 1 2.4 1.3 3.8 1" />
      <path d="M15.8 4.4c-1.3 1-2.4 1.3-3.8 1" />
      <path d="M6.4 11.4c0-3 2.4-5 5.6-5s5.6 2 5.6 5c0 3.4-2.1 6.2-5.6 7-3.5-.8-5.6-3.6-5.6-7z" />
      <path d="M7.7 9.5c1 .55 2 .5 2.7-.3" />
      <path d="M13.6 9.2c.7.8 1.7.85 2.7.3" />
      <path d="M8.3 11.5c.55-.75 1.45-.75 2 0" />
      <path d="M13.7 11.5c.55-.75 1.45-.75 2 0" />
      <circle cx="9.3" cy="11.85" r=".45" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="11.85" r=".45" fill="currentColor" stroke="none" />
      <path d="M12 12.5v1.5" />
      <path d="M10.1 15.5c.55.55 1.15.75 1.9.75s1.35-.2 1.9-.75" />
    </Art>
  );
}

/** Two figures inside a lotus frame. */
export function IconLotusPair(props: IconProps) {
  return (
    <Art {...props}>
      <path d="M12 2.8c2.2 2.6 3.3 5 3.3 7.8 0 3-1.3 5.6-3.3 8.8-2-3.2-3.3-5.8-3.3-8.8 0-2.8 1.1-5.2 3.3-7.8z" />
      <path d="M8.6 7.4C6.4 8.8 5.2 10.6 5.4 13c1.5-.2 2.8-.8 4-1.8" />
      <path d="M15.4 7.4c2.2 1.4 3.4 3.2 3.2 5.6-1.5-.2-2.8-.8-4-1.8" />
      <circle cx="9.7" cy="12.3" r="1.05" />
      <circle cx="14.3" cy="12.3" r="1.05" />
      <path d="M8.2 16.7c.35-1.3 1.05-1.9 1.5-1.9s1.15.6 1.5 1.9" />
      <path d="M12.8 16.7c.35-1.3 1.05-1.9 1.5-1.9s1.15.6 1.5 1.9" />
    </Art>
  );
}

/** Nelum, the lotus, for the Play tab. */
export function IconNelum(props: IconProps) {
  return (
    <Art {...props}>
      <circle cx="12" cy="12" r="2" />
      <path d="M12 3.4c.7 2.2.7 3.4 0 5-.7-1.6-.7-2.8 0-5" />
      <path d="M12 20.6c.7-2.2.7-3.4 0-5-.7 1.6-.7 2.8 0 5" />
      <path d="M3.4 12c2.2.7 3.4.7 5 0-1.6-.7-2.8-.7-5 0" />
      <path d="M20.6 12c-2.2.7-3.4.7-5 0 1.6-.7 2.8-.7 5 0" />
      <path d="M6 6c1.7 1.5 2.5 2.5 3.1 4-1.5-.6-2.5-1.4-4-3.1" />
      <path d="M18 6c-1.7 1.5-2.5 2.5-3.1 4 1.5-.6 2.5-1.4 4-3.1" />
      <path d="M6 18c1.7-1.5 2.5-2.5 3.1-4-1.5.6-2.5 1.4-4 3.1" />
      <path d="M18 18c-1.7-1.5-2.5-2.5-3.1-4 1.5.6 2.5 1.4 4 3.1" />
    </Art>
  );
}

/** Gajasimha head, the leaderboard mark. */
export function IconGajasimha(props: IconProps) {
  return (
    <Art {...props}>
      <path d="M8.2 6.4h7.6L14.8 8.6H9.2z" />
      <path d="M12 3.4v2.8" />
      <path d="M12 3.4c.4.7.4 1.1 0 1.6-.4-.5-.4-.9 0-1.6" />
      <path d="M7 10.2c0-1.8 1.5-3.1 3.6-3.1h2.8c2.1 0 3.6 1.3 3.6 3.1v2.8c0 2.2-1.7 3.7-3.8 4.1" />
      <path d="M6.8 11.8c-1.7.5-2.7 1.7-2.4 3.2" />
      <path d="M13.6 16.8c.3 1.5-.3 2.7-1.6 3.2" />
      <path d="M10.2 15.6c-1.3.6-1.9 1.4-1.4 2.3" />
      <circle cx="13.1" cy="11.6" r=".55" fill="currentColor" stroke="none" />
    </Art>
  );
}

/** A figure set in moonstone rings. */
export function IconMoonProfile(props: IconProps) {
  return (
    <Art {...props}>
      <path d="M3.4 15.6c2.6-2.2 5.3-3.3 8.6-3.3s6 1.1 8.6 3.3" />
      <path d="M5.2 18.2c2-1.6 4.2-2.4 6.8-2.4s4.8.8 6.8 2.4" />
      <path d="M7.2 20.6c1.4-1 3-1.5 4.8-1.5s3.4.5 4.8 1.5" />
      <circle cx="12" cy="8.4" r="2.15" />
      <path d="M8.6 13.6c.7-1.4 1.8-2.1 3.4-2.1s2.7.7 3.4 2.1" />
    </Art>
  );
}

/** Moonstone seal for the rating chip. */
export function IconSeal(props: IconProps) {
  return (
    <Art {...props}>
      <path d="M4 15.2c2.2-2.6 4.8-3.9 8-3.9s5.8 1.3 8 3.9" />
      <path d="M6.1 17.4c1.6-1.8 3.6-2.7 5.9-2.7s4.3.9 5.9 2.7" />
      <path d="M8.2 19.6c1-1.1 2.3-1.6 3.8-1.6s2.8.5 3.8 1.6" />
      <circle cx="12" cy="7.2" r="2.1" />
      <path d="M12 5.2v4" />
      <path d="M10.1 7.2h3.8" />
    </Art>
  );
}

/** A royal crown with a lotus finial. */
export function IconCrown(props: IconProps) {
  return (
    <Art {...props}>
      <path d="M4 17.6h16" />
      <path d="M5.2 17.6 7.4 9.2 12 13.4 16.6 9.2 18.8 17.6" />
      <path d="M12 5.2c.45 1.2.45 1.8 0 2.6-.45-.8-.45-1.4 0-2.6" />
      <path d="M10.2 8.2c.6.7 1.2.9 1.8.7" />
      <path d="M13.8 8.2c-.6.7-1.2.9-1.8.7" />
      <path d="M8.4 17.6c.5-2 1.6-3 3.6-3s3.1 1 3.6 3" />
    </Art>
  );
}

/** Moonstone clock. */
export function IconMoonClock(props: IconProps) {
  return (
    <Art {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="5.3" />
      <path d="M12 12V8.1" />
      <path d="M12 12l2.8 1.6" />
      <circle cx="12" cy="12" r=".7" fill="currentColor" stroke="none" />
    </Art>
  );
}

/** Back chevron with a liyawel curl. */
export function IconBack(props: IconProps) {
  return (
    <Art {...props}>
      <path d="M14.6 5.4 8 12l6.6 6.6" />
      <path d="M8.2 12c2.6.15 4.4 1.1 5.6 2.6" />
      <path d="M11.2 13.4c.7.9 1.1 1.5.8 2.2" />
    </Art>
  );
}

/** Three seeds inside a moonstone ring. */
export function IconMore(props: IconProps) {
  return (
    <Art {...props}>
      <circle cx="12" cy="12" r="8.3" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="8.2" cy="12" r=".85" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r=".85" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="12" r=".85" fill="currentColor" stroke="none" />
    </Art>
  );
}

/** A short liyawel scroll for the wordmark row. */
export function IconVine(props: IconProps) {
  return (
    <svg viewBox="0 0 36 12" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" aria-hidden {...props}>
      <path d="M2 6c3-3.2 6-3.2 8.5 0S16 9.2 18.5 6 24 2.8 26.5 6 32 9.2 34 6" />
      <path d="M10 6c.6-1.6 1.5-2.2 2.4-1.6" />
      <path d="M24 6c.6 1.6 1.5 2.2 2.4 1.6" />
    </svg>
  );
}

/** A full-width liyawel divider. */
export function Liyawel(props: IconProps) {
  return (
    <svg viewBox="0 0 200 16" fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" aria-hidden className="liyawel" {...props}>
      <path d="M4 8c6-4.2 11-4.2 16 0s10 4.2 16 0 10-4.2 16 0 10 4.2 16 0 10-4.2 16 0 10 4.2 16 0 10-4.2 16 0 10 4.2 16 0 10-4.2 16 0 11 4.2 16 0" />
      <path d="M20 8c.8-1.8 2-2.4 3-1.6" />
      <path d="M52 8c.8 1.8 2 2.4 3 1.6" />
      <path d="M84 8c.8-1.8 2-2.4 3-1.6" />
      <path d="M116 8c.8 1.8 2 2.4 3 1.6" />
      <path d="M148 8c.8-1.8 2-2.4 3-1.6" />
      <path d="M180 8c.8 1.8 2 2.4 3 1.6" />
    </svg>
  );
}
