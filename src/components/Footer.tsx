import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div>
        <Link className={styles.brand} href="/">
          <span className={styles.brandMark}>DR</span>
          <span>
            <span className={styles.brandName}>Dulhe Raja</span>
            <span className={styles.brandSub}>Shree Shyam Creation</span>
          </span>
        </Link>
        <p className={styles.desc}>
          Traditional Indian menswear for weddings, festivals and all the
          moments in between.
        </p>
      </div>
      <div>
        <h4>Explore</h4>
        <Link href="/products?category=SHERWANI">Wedding edit (Sherwanis)</Link>
        <Link href="/products?category=KURTA">Festive classics (Kurtas)</Link>
        <Link href="/products?category=PYJAMA">
          Everyday essentials (Pyjamas)
        </Link>
        <Link href="/products?category=INDO_WESTERN">Indo-Western sets</Link>
      </div>
      <div>
        <h4>Need a hand?</h4>
        <Link href="/track-order">Track your order</Link>
        <Link href="/cart">Shopping bag</Link>
      </div>
      <div className={styles.footerBottom}>
        <span>Dulhe Raja — Shree Shyam Creation, Kolkata</span>
        <span>Custom Tailoring &amp; Occasion Wear</span>
      </div>
    </footer>
  );
}
