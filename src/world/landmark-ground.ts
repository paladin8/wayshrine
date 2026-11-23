import fushimiInari from "./landmark-grounds/fushimi-inari.json";
import kinkakuJi from "./landmark-grounds/kinkaku-ji.json";
import todaiJiDaibutsu from "./landmark-grounds/todai-ji-daibutsu.json";
import itsukushimaTorii from "./landmark-grounds/itsukushima-torii.json";
import himejiCastle from "./landmark-grounds/himeji-castle.json";
import meotoIwa from "./landmark-grounds/meoto-iwa.json";
import kiyomizuDera from "./landmark-grounds/kiyomizu-dera.json";
import enoshimaLighthouse from "./landmark-grounds/enoshima-lighthouse.json";
import horyuJi from "./landmark-grounds/horyu-ji.json";
import hirosakiCastle from "./landmark-grounds/hirosaki-castle.json";
import shirakawaGo from "./landmark-grounds/shirakawa-go.json";
import matsumotoCastle from "./landmark-grounds/matsumoto-castle.json";
import zaoJuhyo from "./landmark-grounds/zao-juhyo.json";
import kenrokuEn from "./landmark-grounds/kenroku-en.json";
import mountFuji from "./landmark-grounds/mount-fuji.json";
import nikkoToshogu from "./landmark-grounds/nikko-toshogu.json";
import kegonFalls from "./landmark-grounds/kegon-falls.json";
import kappaBashi from "./landmark-grounds/kappa-bashi.json";
import tateyamaKurobe from "./landmark-grounds/tateyama-kurobe.json";
import koyasanOkunoin from "./landmark-grounds/koyasan-okunoin.json";
import yoshinoYama from "./landmark-grounds/yoshino-yama.json";
import kushiroShitsugen from "./landmark-grounds/kushiro-shitsugen.json";
import oze from "./landmark-grounds/oze.json";
import yanagawa from "./landmark-grounds/yanagawa.json";
import kurashikiBikan from "./landmark-grounds/kurashiki-bikan.json";
import byodoIn from "./landmark-grounds/byodo-in.json";
import sensoJi from "./landmark-grounds/senso-ji.json";
import kamakuraDaibutsu from "./landmark-grounds/kamakura-daibutsu.json";
import tokyoTower from "./landmark-grounds/tokyo-tower.json";
import osakaCastle from "./landmark-grounds/osaka-castle.json";
import jomonSugi from "./landmark-grounds/jomon-sugi.json";
import shirataniUnsuikyo from "./landmark-grounds/shiratani-unsuikyo.json";
import arashiyama from "./landmark-grounds/arashiyama.json";
import nachiFalls from "./landmark-grounds/nachi-falls.json";
import meijiJingu from "./landmark-grounds/meiji-jingu.json";
import iseJingu from "./landmark-grounds/ise-jingu.json";
import izumoTaisha from "./landmark-grounds/izumo-taisha.json";
import takachiho from "./landmark-grounds/takachiho.json";
import iyaKazurabashi from "./landmark-grounds/iya-kazurabashi.json";
import ginkakuJi from "./landmark-grounds/ginkaku-ji.json";
import ryoanJi from "./landmark-grounds/ryoan-ji.json";
import sakurajima from "./landmark-grounds/sakurajima.json";
import mountAso from "./landmark-grounds/mount-aso.json";
import beppuHells from "./landmark-grounds/beppu-hells.json";
import owakudani from "./landmark-grounds/owakudani.json";
import kumamotoCastle from "./landmark-grounds/kumamoto-castle.json";
import dazaifu from "./landmark-grounds/dazaifu.json";
import dogoOnsen from "./landmark-grounds/dogo-onsen.json";
import kintaikyo from "./landmark-grounds/kintaikyo.json";
import gunkanjima from "./landmark-grounds/gunkanjima.json";
import naruto from "./landmark-grounds/naruto.json";
import shuriCastle from "./landmark-grounds/shuri-castle.json";
import taketomi from "./landmark-grounds/taketomi.json";
import matsushima from "./landmark-grounds/matsushima.json";
import amanohashidate from "./landmark-grounds/amanohashidate.json";
import tottoriDunes from "./landmark-grounds/tottori-dunes.json";
import shiretoko from "./landmark-grounds/shiretoko.json";

/**
 * What the world needs to know about a crafted landmark model, exported by the
 * model's generator (content/landmarks/<id>.py). Coordinates are relative to the
 * region's site, in game axes (x right, z toward the camera), heights above the
 * model's origin.
 */
export interface LandmarkGround {
  /** The model's square footprint is [-half, half] on both axes. */
  readonly half: number;
  /** Spacing of the `ground` grid. */
  readonly step: number;
  /** Walkable surface height, indexed [z][x] from (-half, -half). */
  readonly ground: ReadonlyArray<readonly number[]>;
  /**
   * Height the terrain follows under the model, where it differs from the walkable `ground` (a stage on
   * posts has a deck above open ground). Same grid as `ground`; absent when the two are the same.
   */
  readonly terrain?: ReadonlyArray<readonly number[]>;
  /** The terrain provides the visible ground beneath the model. */
  readonly terrainSurface?: boolean;
  /** Solid discs [x, z, r]: columns, posts, trees, statues. */
  readonly solids: ReadonlyArray<readonly [number, number, number]>;
  /** Authored approach point and radius. The compass uses the point. */
  readonly interact: readonly [number, number];
  readonly reach: number;
  /** Where the player arrives when travelling here. */
  readonly stand: readonly [number, number];
}

const GROUNDS: Readonly<Record<string, LandmarkGround>> = {
  "fushimi-inari": fushimiInari as unknown as LandmarkGround,
  "kinkaku-ji": kinkakuJi as unknown as LandmarkGround,
  "todai-ji-daibutsu": todaiJiDaibutsu as unknown as LandmarkGround,
  "itsukushima-torii": itsukushimaTorii as unknown as LandmarkGround,
  "himeji-castle": himejiCastle as unknown as LandmarkGround,
  "meoto-iwa": meotoIwa as unknown as LandmarkGround,
  "kiyomizu-dera": kiyomizuDera as unknown as LandmarkGround,
  "enoshima-lighthouse": enoshimaLighthouse as unknown as LandmarkGround,
  "horyu-ji": horyuJi as unknown as LandmarkGround,
  "hirosaki-castle": hirosakiCastle as unknown as LandmarkGround,
  "shirakawa-go": shirakawaGo as unknown as LandmarkGround,
  "matsumoto-castle": matsumotoCastle as unknown as LandmarkGround,
  "zao-juhyo": zaoJuhyo as unknown as LandmarkGround,
  "kenroku-en": kenrokuEn as unknown as LandmarkGround,
  "mount-fuji": mountFuji as unknown as LandmarkGround,
  "nikko-toshogu": nikkoToshogu as unknown as LandmarkGround,
  "kegon-falls": kegonFalls as unknown as LandmarkGround,
  "kappa-bashi": kappaBashi as unknown as LandmarkGround,
  "tateyama-kurobe": tateyamaKurobe as unknown as LandmarkGround,
  "koyasan-okunoin": koyasanOkunoin as unknown as LandmarkGround,
  "yoshino-yama": yoshinoYama as unknown as LandmarkGround,
  "kushiro-shitsugen": kushiroShitsugen as unknown as LandmarkGround,
  oze: oze as unknown as LandmarkGround,
  yanagawa: yanagawa as unknown as LandmarkGround,
  "kurashiki-bikan": kurashikiBikan as unknown as LandmarkGround,
  "byodo-in": byodoIn as unknown as LandmarkGround,
  "senso-ji": sensoJi as unknown as LandmarkGround,
  "kamakura-daibutsu": kamakuraDaibutsu as unknown as LandmarkGround,
  "tokyo-tower": tokyoTower as unknown as LandmarkGround,
  "osaka-castle": osakaCastle as unknown as LandmarkGround,
  "jomon-sugi": jomonSugi as unknown as LandmarkGround,
  "shiratani-unsuikyo": shirataniUnsuikyo as unknown as LandmarkGround,
  arashiyama: arashiyama as unknown as LandmarkGround,
  "nachi-falls": nachiFalls as unknown as LandmarkGround,
  "meiji-jingu": meijiJingu as unknown as LandmarkGround,
  "ise-jingu": iseJingu as unknown as LandmarkGround,
  "izumo-taisha": izumoTaisha as unknown as LandmarkGround,
  takachiho: takachiho as unknown as LandmarkGround,
  "iya-kazurabashi": iyaKazurabashi as unknown as LandmarkGround,
  "ginkaku-ji": ginkakuJi as unknown as LandmarkGround,
  "ryoan-ji": ryoanJi as unknown as LandmarkGround,
  sakurajima: sakurajima as unknown as LandmarkGround,
  "mount-aso": mountAso as unknown as LandmarkGround,
  "beppu-hells": beppuHells as unknown as LandmarkGround,
  owakudani: owakudani as unknown as LandmarkGround,
  "kumamoto-castle": kumamotoCastle as unknown as LandmarkGround,
  dazaifu: dazaifu as unknown as LandmarkGround,
  "dogo-onsen": dogoOnsen as unknown as LandmarkGround,
  kintaikyo: kintaikyo as unknown as LandmarkGround,
  gunkanjima: gunkanjima as unknown as LandmarkGround,
  naruto: naruto as unknown as LandmarkGround,
  "shuri-castle": shuriCastle as unknown as LandmarkGround,
  taketomi: taketomi as unknown as LandmarkGround,
  matsushima: matsushima as unknown as LandmarkGround,
  amanohashidate: amanohashidate as unknown as LandmarkGround,
  "tottori-dunes": tottoriDunes as unknown as LandmarkGround,
  shiretoko: shiretoko as unknown as LandmarkGround,
};

export function groundOf(id: string): LandmarkGround | undefined {
  return GROUNDS[id];
}

type Grid = ReadonlyArray<readonly number[]>;

function sample(g: LandmarkGround, grid: Grid, dx: number, dz: number): number {
  const n = grid.length;
  const fx = Math.min(n - 1, Math.max(0, (dx + g.half) / g.step));
  const fz = Math.min(n - 1, Math.max(0, (dz + g.half) / g.step));
  const x0 = Math.min(n - 2, Math.floor(fx));
  const z0 = Math.min(n - 2, Math.floor(fz));
  const tx = fx - x0;
  const tz = fz - z0;
  const at = (ix: number, iz: number): number => grid[iz]![ix]!;
  return (
    at(x0, z0) * (1 - tx) * (1 - tz) + at(x0 + 1, z0) * tx * (1 - tz) + at(x0, z0 + 1) * (1 - tx) * tz + at(x0 + 1, z0 + 1) * tx * tz
  );
}

/** Walkable model height at an offset from the site, clamped to the footprint; bilinear between grid points. */
export function groundHeight(g: LandmarkGround, dx: number, dz: number): number {
  return sample(g, g.ground, dx, dz);
}

/** Height of the terrain under the model: the walkable ground, less any decks standing over open ground. */
export function surfaceHeight(g: LandmarkGround, dx: number, dz: number): number {
  return sample(g, g.terrain ?? g.ground, dx, dz);
}
