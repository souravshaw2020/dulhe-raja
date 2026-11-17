import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import ShopShowcase, { StorefrontProduct } from "@/components/ShopShowcase";
import SubscriberForm from "@/components/SubscriberForm";
import styles from "./page.module.css";

async function LiveShopSection() {
  await connection();

  const products = await prisma.product.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { isPrimary: "desc" }, take: 1 },
      variants: { take: 1 },
    },
  });

  const mapped: StorefrontProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    basePrice: Number(p.basePrice),
    imageUrl: p.images[0]?.s3Url || "/globe.svg",
    altText: p.images[0]?.altText || p.name,
    defaultVariantId: p.variants[0]?.id,
  }));

  return <ShopShowcase initialProducts={mapped} />;
}

export default function HomePage() {
  return (
    <main id="home">
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>Tradition, tailored for you</div>
          <h1 className={styles.heroTitle}>
            Every occasion
            <br />
            deserves a <em>royal</em>
            <br />
            entrance.
          </h1>
          <p className={styles.heroDesc}>
            From the groom&apos;s grand celebration to everyday elegance,
            discover Indian menswear made for moments that matter.
          </p>
          <div className={styles.ctaRow}>
            <a className={styles.btn} href="#shop">
              Shop the collection
            </a>
            <a
              className={`${styles.btn} ${styles.btnOutline}`}
              href="#collections"
            >
              Explore occasions
            </a>
          </div>
        </div>

        <div
          className={styles.heroArt}
          aria-label="Illustration of a traditional sherwani"
        >
          <div className={styles.artHalo} />
          <svg
            className={styles.illustration}
            viewBox="0 0 300 440"
            role="img"
            aria-label="Illustrated cream sherwani with gold detailing"
          >
            <defs>
              <linearGradient id="coat" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#fff4df" />
                <stop offset=".55" stopColor="#e8d2ad" />
                <stop offset="1" stopColor="#c4a477" />
              </linearGradient>
              <linearGradient id="sash" x1="0" y1="0" x2="1" y2="0">
                <stop stopColor="#6f1729" />
                <stop offset="1" stopColor="#9b3441" />
              </linearGradient>
            </defs>
            <ellipse
              cx="150"
              cy="421"
              rx="90"
              ry="8"
              fill="#5c352b"
              opacity=".18"
            />
            <path
              d="M120 46 Q150 30 180 46 L197 65 222 92 205 167 215 294 193 400 160 400 151 280 141 400 106 400 86 294 95 167 78 92 103 65Z"
              fill="url(#coat)"
              stroke="#b99b70"
              strokeWidth="1.5"
            />
            <path
              d="M120 46 L150 83 180 46 168 37 132 37Z"
              fill="#f7e6c9"
              stroke="#b99b70"
            />
            <path d="M150 82 L150 291" stroke="#a98a5c" strokeWidth="2" />
            <path
              d="M145 85 L127 111 138 131 150 111 162 131 173 111 155 85Z"
              fill="#6f1729"
            />
            <path
              d="M110 127 L88 153 96 196 119 185Z M190 127 L212 153 204 196 181 185Z"
              fill="#e2c79b"
              stroke="#b99b70"
            />
            <path
              d="M112 193 L188 193 184 291 116 291Z"
              fill="url(#sash)"
              opacity=".96"
            />
            <path
              d="M121 200 L179 200 M119 216 L181 216 M118 232 L182 232 M117 248 L183 248 M116 264 L184 264 M116 280 L184 280"
              stroke="#d8b778"
              strokeWidth="1"
              opacity=".85"
            />
            <path
              d="M109 294 L191 294 194 400 160 400 151 315 141 400 106 400Z"
              fill="#e8d2ad"
              stroke="#b99b70"
            />
            <path
              d="M121 300 L132 397 M178 300 L168 397"
              stroke="#c1a276"
              strokeWidth="1"
            />
            <g fill="#9c7748">
              <circle cx="150" cy="148" r="2.5" />
              <circle cx="150" cy="166" r="2.5" />
              <circle cx="150" cy="184" r="2.5" />
              <circle cx="150" cy="202" r="2.5" />
              <circle cx="150" cy="220" r="2.5" />
              <circle cx="150" cy="238" r="2.5" />
              <circle cx="150" cy="256" r="2.5" />
            </g>
            <path
              d="M111 112 Q150 131 189 112"
              fill="none"
              stroke="#c3a16e"
              strokeWidth="1.5"
            />
            <path
              d="M105 167 Q150 179 195 167"
              fill="none"
              stroke="#c3a16e"
              strokeWidth="1"
            />
          </svg>
        </div>
      </section>

      <div className={styles.benefits}>
        <div className={styles.benefit}>
          <span>✦</span> Occasion-ready styles
        </div>
        <div className={styles.benefit}>
          <span>✦</span> Classic Indian craftsmanship
        </div>
        <div className={styles.benefit}>
          <span>✦</span> Custom tailoring fit
        </div>
      </div>

      <section className={styles.section} id="collections">
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.eyebrow}>Find your look</div>
            <h2>Made for every moment</h2>
          </div>
          <p className={styles.sectionIntro}>
            A considered edit of traditional silhouettes for celebrations,
            festivities and the everyday.
          </p>
        </div>

        <div className={styles.collectionGrid}>
          <Link
            href="/products?category=SHERWANI"
            className={styles.collection}
          >
            <div className={styles.collectionVisual}>
              <svg viewBox="0 0 180 280" aria-hidden="true">
                <path
                  d="M67 25 Q90 15 113 25 L127 47 146 67 132 115 137 252 108 260 91 154 84 260 53 252 49 115 34 67 53 47Z"
                  fill="#6f1729"
                  stroke="#d5b77e"
                  strokeWidth="1.5"
                />
                <path d="M67 25 L90 56 113 25 105 19 75 19Z" fill="#f2dfb9" />
                <path d="M90 56V150" stroke="#d5b77e" strokeWidth="2" />
                <path
                  d="M72 74 L90 92 108 74"
                  fill="none"
                  stroke="#d5b77e"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div className={styles.collectionLabel}>
              <strong>The Wedding Edit</strong>
              <small>Sherwanis ↗</small>
            </div>
          </Link>

          <Link href="/products?category=KURTA" className={styles.collection}>
            <div className={styles.collectionVisual}>
              <svg viewBox="0 0 180 280" aria-hidden="true">
                <path
                  d="M65 33 Q90 21 115 33 L129 53 145 75 129 120 137 252 108 258 91 156 83 258 53 252 51 120 35 75 51 53Z"
                  fill="#c78c45"
                  stroke="#f3dfb8"
                  strokeWidth="1.5"
                />
                <path d="M65 33 L90 60 115 33 105 26 75 26Z" fill="#f8e8cb" />
                <path d="M90 60V155" stroke="#f7e5c0" strokeWidth="2" />
              </svg>
            </div>
            <div className={styles.collectionLabel}>
              <strong>Festive Classics</strong>
              <small>Kurtas ↗</small>
            </div>
          </Link>

          <Link href="/products?category=PYJAMA" className={styles.collection}>
            <div className={styles.collectionVisual}>
              <svg viewBox="0 0 180 280" aria-hidden="true">
                <path
                  d="M60 40 H120 L128 252 H98 L90 135 L82 252 H52 Z"
                  fill="#274d43"
                  stroke="#d8c6a5"
                  strokeWidth="1.5"
                />
                <path d="M60 54 H120" stroke="#d8c6a5" strokeWidth="1.5" />
                <path d="M90 54 V72" stroke="#f4e4c6" strokeWidth="1.5" />
              </svg>
            </div>
            <div className={styles.collectionLabel}>
              <strong>Everyday Ease</strong>
              <small>Pyjamas ↗</small>
            </div>
          </Link>

          <Link
            href="/products?category=INDO_WESTERN"
            className={styles.collection}
          >
            <div className={styles.collectionVisual}>
              <svg viewBox="0 0 180 280" aria-hidden="true">
                <path
                  d="M66 28 Q90 18 114 28 L128 48 144 70 130 114 136 250 106 258 90 152 82 258 52 250 49 114 35 70 51 48Z"
                  fill="#3f2a2b"
                  stroke="#d7b778"
                  strokeWidth="1.5"
                />
                <path
                  d="M66 28 L98 85 L114 28"
                  fill="none"
                  stroke="#d7b778"
                  strokeWidth="1.8"
                />
                <path d="M98 85 V154" stroke="#d7b778" strokeWidth="1.6" />
              </svg>
            </div>
            <div className={styles.collectionLabel}>
              <strong>Reception Edit</strong>
              <small>Indo-Western ↗</small>
            </div>
          </Link>
        </div>
      </section>

      <Suspense
        fallback={
          <section className={`${styles.section} ${styles.productsSection}`}>
            <p style={{ color: "#7b665b" }}>Loading collection...</p>
          </section>
        }
      >
        <LiveShopSection />
      </Suspense>

      <section className={styles.story} id="story">
        <div className={styles.storyArt}>
          <svg viewBox="0 0 180 280" aria-hidden="true">
            <path
              d="M66 29 Q90 18 114 29 L128 48 143 69 129 111 135 218 106 224 91 141 82 224 53 218 50 111 37 69 52 48Z"
              fill="#f0dfc1"
              stroke="#d8b778"
              strokeWidth="1.4"
            />
            <path d="M66 29 L90 55 114 29 105 22 75 22Z" fill="#fff4dc" />
            <path d="M90 55V143" stroke="#d8b778" strokeWidth="1.5" />
          </svg>
        </div>
        <div className={styles.storyCopy}>
          <div className={styles.eyebrow}>A little tradition, a lot of you</div>
          <h2>
            Rooted in tradition.
            <br />
            Worn your way.
          </h2>
          <p>
            At Dulhe Raja, we believe what you wear should feel as special as
            the moment itself. Discover classic Indian silhouettes, rich
            occasion colours and bespoke tailoring for celebrations big and
            small.
          </p>
          <Link className={`${styles.btn} ${styles.storyBtn}`} href="/products">
            Find your style
          </Link>
        </div>
      </section>

      <SubscriberForm />
    </main>
  );
}
