import Image from "next/image";
import styles from "./Loader.module.css";

interface LoaderProps {
  variant?: "page" | "section" | "compact";
  label?: string;
}

export default function Loader({
  variant = "page",
  label = "Loading",
}: LoaderProps) {
  const size = variant === "compact" ? 34 : 48;

  return (
    <div
      className={`${styles.container} ${styles[variant]}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className={styles.ringWrap}>
        <span className={styles.ring} aria-hidden="true" />
        <Image
          src="/royal-dulhe-raja-logo.png"
          alt=""
          width={size}
          height={size}
          priority
          className={styles.logo}
        />
      </div>
      <span className={styles.srOnly}>{label}</span>
    </div>
  );
}
