/**
 * Turns the supplied collection of Japanese texts into the files the game loads.
 * Pure and dependency-free so it runs both from `npm run content` (plain Node) and
 * from the test that checks the generated files are up to date.
 */

export type TextKind = "haiku" | "proverb" | "fourCharacter" | "idiom";
export type Season = "spring" | "summer" | "autumn" | "winter" | "newyear";
export type SceneryBiome = "meadow" | "water" | "snow" | "mountain";

export interface SourceEntry {
  id: string;
  type: "haiku" | "proverb" | "four_character_idiom" | "idiom";
  japanese: string;
  english: string;
  author?: string;
}

export interface SourceFile {
  entries: SourceEntry[];
}

export interface Scenery {
  biome: SceneryBiome;
  season: Season;
  scene: string;
  /** The landmark the poem is about, by its id in docs/landmarks.md. */
  landmark?: string;
}

/** One text as the game shows it. */
export interface TextEntry {
  id: string;
  kind: TextKind;
  ja: string;
  en: string;
  /** Haiku only: the poem in three lines, for the vertical layout. Joined, equal to `ja`. */
  lines?: [string, string, string];
  /** Present for haiku, which are credited to their poet. */
  by?: { en: string; ja: string };
}

/** The part of a text the world needs to place its monument; small enough to ship in the main bundle. */
export interface IndexEntry {
  id: string;
  kind: TextKind;
  /** Haiku only: where the poem belongs. */
  biome?: SceneryBiome;
  season?: Season;
  scene?: string;
  landmark?: string;
}

export interface Built {
  texts: TextEntry[];
  index: IndexEntry[];
}

const KIND: Record<SourceEntry["type"], TextKind> = {
  haiku: "haiku",
  proverb: "proverb",
  four_character_idiom: "fourCharacter",
  idiom: "idiom",
};

const POETS: Record<string, { en: string; ja: string }> = {
  "Matsuo Bashō": { en: "Matsuo Bashō", ja: "松尾芭蕉" },
  "Yosa Buson": { en: "Yosa Buson", ja: "与謝蕪村" },
  "Kobayashi Issa": { en: "Kobayashi Issa", ja: "小林一茶" },
};

/**
 * English shown in game where it differs from the source collection. Keyed by source id;
 * everything not listed is left unchanged.
 *
 * Parenthetical cleanup: spelling variants and grammatical slot-fillers in the dictionary
 * glosses carry no information on a monument, so they are dropped or unwrapped. Asides
 * that explain the meaning ("(because they are poisonous)") are kept.
 *
 * Translation review: glosses that misstated the meaning, used an English saying that
 * does not match (or that few readers know), were ungrammatical, or flattened the image
 * the Japanese is built on. Where an English equivalent is accurate and well known it is
 * kept; otherwise the gloss follows the Japanese image. A few haiku renderings are revised
 * for accuracy (水仙 is a narcissus; 弓取 is a warrior).
 */
export const ENGLISH_OVERRIDES: Readonly<Record<string, string>> = {
  // Parenthetical cleanup
  "jmdict-2144020": "a student must never forget to honor their teacher",
  "jmdict-2175010": "love your neighbor",
  "jmdict-2761670": "one never knows what will happen",
  "jmdict-2845253": "a teetotaler doesn't know how tasty water is when waking up after having been drunk",
  "jmdict-2869699": "the more people fight, the closer they are",
  "jmdict-2870266": "those who have it (especially wealth) have it",
  "jmdict-2832638": "the lesson that one should not leave things unfinished",
  "jmdict-1157650": "saying with one voice",
  "jmdict-1163550": "critical, touch-and-go situation",
  "jmdict-1164870": "something having its merits and demerits",
  "jmdict-1341040": "spring, summer, autumn and winter",
  "jmdict-1378980": "having life-and-death power over someone",
  "jmdict-1383200": "shifting the responsibility for something on to someone",
  "jmdict-1388870": "once-in-a-lifetime opportunity",
  "jmdict-1529720": "losing oneself in something",
  "jmdict-1536160": "treasuring something by never taking it off the premises",
  "jmdict-1005940": "unmanageable person (especially a woman)",
  "jmdict-1085240": "vanguard",
  "jmdict-1165740": "to intimidate someone",
  "jmdict-1185790": "to leave everything to someone",
  "jmdict-1186700": "to unmask someone's true nature",
  "jmdict-1267620": "book of trade secrets",
  "jmdict-1300320": "showing someone special courtesy (to persuade them to take a post)",
  "jmdict-1300610": "set of three status symbols",
  "jmdict-1327280": "to cut one's connections with someone",
  // Translation review: haiku
  "haiku-basho-mwDcQ": "Summer grasses\nall that remains\nof warriors' dreams", // 夏草や兵どもが夢の跡
  "haiku-basho-mwF_8": "First snow\njust enough to bend\nthe narcissus leaves", // 初雪や水仙の葉のたわむ程
  "haiku-buson-2427": "A warrior asks me\nabout poetry\nautumn dusk", // 弓取に哥とはれけり秋の暮
  "haiku-issa-deer-manuscript": "Pillowed on each other's legs\nhow tenderly\nthe deer lie together", // 足枕手まくら鹿のむつまじや
  // Translation review: proverbs
  "jmdict-2152700": "fortune comes to the house that laughs", // 笑う門には福来る
  "jmdict-1012150": "let the one who proposes it go first", // 先ず隗より始めよ
  "jmdict-1244330": "praying to the gods only when in trouble", // 苦しい時の神頼み
  "jmdict-1301010": "put three heads together and you have a sage's wisdom", // 三人寄れば文殊の知恵
  "jmdict-1345120": "three women together make a racket", // 女三人寄れば姦しい
  "jmdict-1366970": "fortune and misfortune turn into each other, like the old man's horse", // 人間万事塞翁が馬
  "jmdict-1394290": "if it's good, do it now", // 善は急げ
  "jmdict-1548670": "fallen blossoms never return to the branch; a broken mirror never shines again", // 落花枝に帰らず破鏡再び照らさず
  "jmdict-1551520": "the departing bird does not muddy the water", // 立つ鳥跡を濁さず
  "jmdict-1571720": "there's no accounting for taste", // 蓼食う虫も好き好き
  "jmdict-1778490": "even a kappa can be swept away by the river", // 河童の川流れ
  "jmdict-2078700": "a lie can serve a purpose", // 嘘も方便
  "jmdict-2078950": "when pressed, you protect what matters most", // 背に腹は変えられない
  "jmdict-2086560": "cranes live a thousand years, tortoises ten thousand", // 鶴は千年亀は万年
  "jmdict-2088230": "do your best and leave the rest to heaven", // 人事を尽くして天命を待つ
  "jmdict-2089340": "love turns pockmarks into dimples", // あばたもえくぼ
  "jmdict-2096390": "children never know their parents' hearts", // 親の心子知らず
  "jmdict-2103020": "send the child you love out into the world", // かわいい子には旅をさせよ
  "jmdict-2111630": "the pheasant would not be shot if it did not cry", // 雉も鳴かずば撃たれまい
  "jmdict-2125080": "the boy at the temple gate recites sutras he was never taught", // 門前の小僧習わぬ経を読む
  "jmdict-2128160": "there are green hills everywhere; go boldly out into the world", // 人間到る処青山あり
  "jmdict-2134480": "love is blind", // 恋は盲目
  "jmdict-2141040": "mugwort growing among hemp grows straight", // 麻の中の蓬
  "jmdict-2141070": "dripping water wears away stone", // 雨垂れ石を穿つ
  "jmdict-2152710": "not everyone in the world is a demon", // 渡る世間に鬼はない
  "jmdict-2152870": "there aren't always loaches under the willow", // 柳の下にいつも泥鰌はおらぬ
  "jmdict-2152920": "peaches and chestnuts take three years, persimmons eight", // 桃栗三年柿八年
  "jmdict-2153130": "the eyes speak as much as the mouth", // 目は口ほどに物を言う
  "jmdict-2158240": "hardship in youth is worth buying", // 若い時の苦労は買うてもせよ
  "jmdict-2165330": "youth fades quickly, learning comes slowly", // 少年老い易く学成り難し
  "jmdict-2168810": "he who does not work shall not eat", // 働かざる者食うべからず
  "jmdict-2200740": "it won't always be a moonlit night (watch your back)", // 月夜の晩ばかりじゃない
  "jmdict-2201620": "courtesy matters even between close friends", // 親しき仲にも礼儀あり
  "jmdict-2252990": "the soul of a three-year-old lasts to a hundred", // 三つ子の魂百まで
  "jmdict-2269940": "the ghost turned out to be withered pampas grass", // 幽霊の正体見たり枯れ尾花
  "jmdict-2395080": "too much is as bad as too little", // 過ぎたるは及ばざるがごとし
  "jmdict-2396880": "food over romance", // 色気より食い気
  "jmdict-2416680": "laugh at a penny and you'll weep for a penny", // 一銭を笑う者は一銭に泣く
  "jmdict-2416740": "a stranger nearby is better than a relative far away", // 遠くの親類より近くの他人
  "jmdict-2416830": "pinch yourself to know how others feel pain", // 我が身をつねって人の痛さを知れ
  "jmdict-2416980": "enter through the narrow gate", // 狭き門より入れ
  "jmdict-2417080": "a wise man changes his mind, a fool never", // 君子豹変す
  "jmdict-2417160": "a sound mind dwells in a sound body", // 健全なる精神は健全なる身体に宿る
  "jmdict-2417180": "seeing something and hearing about it are very different", // 見ると聞くとは大違い
  "jmdict-2417360": "once past the throat, the heat is forgotten", // 喉元過ぎれば熱さを忘れる
  "jmdict-2417400": "the hasty beggar gets little", // 慌てる乞食はもらいが少ない
  "jmdict-2417500": "what happens to another today may happen to me tomorrow", // 今日は人の身明日は我が身
  "jmdict-2417550": "the schemer drowns in his own schemes", // 策士策に溺れる
  "jmdict-2417580": "the sansho pepper is small, but it bites", // 山椒は小粒でもぴりりと辛い
  "jmdict-2417740": "in times of peace, do not forget war", // 治に居て乱を忘れず
  "jmdict-2417750": "unsown seeds do not sprout", // 蒔かぬ種は生えぬ
  "jmdict-2417760": "the hunter chasing the deer does not see the mountain", // 鹿を追う者は山を見ず
  "jmdict-2417780": "if one god abandons you, another picks you up", // 捨てる神あれば拾う神あり
  "jmdict-2417800": "a snake knows the ways of snakes", // 蛇の道は蛇
  "jmdict-2417820": "mix with vermilion and you turn red", // 朱に交われば赤くなる
  "jmdict-2417830": "sake is the best of all medicines", // 酒は百薬の長
  "jmdict-2417850": "habit becomes second nature", // 習い性となる
  "jmdict-2417870": "look at both sides of the shield", // 盾の両面を見よ
  "jmdict-2417880": "never forget your beginner's spirit", // 初心忘るべからず
  "jmdict-2417900": "heat and cold both end by the equinox", // 暑さ寒さも彼岸まで
  "jmdict-2417910": "a woman's determination can pierce rock", // 女の一念岩をも通す
  "jmdict-2417920": "a woman's hair can tether even a great elephant", // 女の髪の毛には大象も繋がる
  "jmdict-2417950": "win and you are the imperial army; lose and you are rebels", // 勝てば官軍、負ければ賊軍
  "jmdict-2417960": "to shoot the general, first shoot his horse", // 将を射んと欲すれば先ず馬を射よ
  "jmdict-2417970": "sacrifice something small to save something great", // 小の虫を殺して大の虫を生かす
  "jmdict-2418030": "there is always someone better", // 上には上がある
  "jmdict-2418050": "kindness can backfire", // 情けが仇
  "jmdict-2418090": "a child who sleeps well grows well", // 寝る子は育つ
  "jmdict-2418180": "children grow up even without parents", // 親はなくても子は育つ
  "jmdict-2418210": "gossip lasts only seventy-five days", // 人の噂も七十五日
  "jmdict-2418240": "chase away your own flies before chasing others'", // 人の蠅を追うより己の蠅を追え
  "jmdict-2418260": "a person lives one lifetime; a name lives forever", // 人は一代名は末代
  "jmdict-2418290": "blame yourself rather than others", // 人を怨むより身を怨め
  "jmdict-2418320": "curse someone and you dig two graves", // 人を呪わば穴二つ
  "jmdict-2418390": "human life is a mere fifty years", // 人生僅か五十年
  "jmdict-2418460": "a taste for the pleasure quarters will ruin you", // 粋が身を食う
  "jmdict-2418480": "a sparrow never forgets its dance, even at a hundred", // 雀百まで踊り忘れず
  "jmdict-2418560": "the parent who raises you is dearer than the one who bore you", // 生みの親より育ての親
  "jmdict-2418610": "youth never comes twice", // 盛年重ねて来たらず
  "jmdict-2418680": "a great dike crumbles from a single ant hole", // 千丈の堤も蟻の一穴より崩れる
  "jmdict-2418880": "before a great undertaking, small matters must give way", // 大事の前の小事
  "jmdict-2418900": "nothing costs as much as what is free", // タダより高いものはない
  "jmdict-2418930": "act with resolve and even gods and demons step aside", // 断じて行えば鬼神も之を避く
  "jmdict-2419030": "your greatest strength is also your weakness", // 長所は短所
  "jmdict-2419100": "heaven does not give anyone two gifts", // 天は二物を与えず
  "jmdict-2419110": "autumn: the sky is high and the horses grow fat", // 天高く馬肥ゆる秋
  "jmdict-2419120": "never get up from a fall empty-handed", // 転んでもただは起きぬ
  "jmdict-2419180": "catch the thief, and he turns out to be your own child", // 盗人を捕らえて見れば我が子なり
  "jmdict-2419250": "if you eat poison, lick the plate too", // 毒を食らわば皿まで
  "jmdict-2419290": "the sun is setting, and the road is still long", // 日暮れて道遠し
  "jmdict-2419410": "fools and scissors are useful if you use them well", // 馬鹿と鋏は使いよう
  "jmdict-2419440": "the defeated general does not speak of tactics", // 敗軍の将は兵を語らず
  "jmdict-2419530": "even a dog won't touch a couple's quarrel", // 夫婦喧嘩は犬も食わない
  "jmdict-2419580": "your stomach is part of you too (so don't overeat)", // 腹も身の内
  "jmdict-2419620": "it never hurts to talk it over", // ものは相談
  "jmdict-2419630": "it's all in how you say it", // 物も言い様
  "jmdict-2419650": "speak, and your lips grow cold in the autumn wind", // 物言えば唇寒し秋の風
  "jmdict-2419700": "heaven to hear of, hell to see", // 聞いて極楽見て地獄
  "jmdict-2419800": "the nameless stars come out first at dusk", // 名の無い星は宵から出る
  "jmdict-2419810": "a name reveals the nature", // 名は体を表す
  "jmdict-2419820": "the longer you live, the more shame you bear", // 命長ければ恥多し
  "jmdict-2419840": "talk about tomorrow and the demons laugh", // 明日のことを言えば鬼が笑う
  "jmdict-2419960": "a red sunset means fair weather; a red sunrise, rain", // 夕焼けは晴れ朝焼けは雨
  "jmdict-2419980": "there's luck in the leftovers", // 余り物に福がある
  "jmdict-2420090": "two heroes cannot stand side by side", // 両雄並び立たず
  "jmdict-2420180": "for rice cakes, go to the rice-cake maker", // 餅は餅屋
  "jmdict-2429060": "know your enemy and know yourself, and you need not fear a hundred battles", // 敵を知り己を知れば百戦危うからず
  "jmdict-2539840": "how you do one thing is how you do everything", // 一事が万事
  "jmdict-2566580": "say there's a tiger in the market often enough and people will believe it", // 市に虎あり
  "jmdict-2570040": "red sky at night, sailor's delight; red sky in the morning, sailor's warning", // 朝焼けは雨、夕焼けは晴れ
  "jmdict-2588420": "a stone from another mountain can polish your jade", // 他山の石以て玉を攻むべし
  "jmdict-2624850": "small bags and young daughters cost more than they seem", // 小袋と小娘
  "jmdict-2637400": "softness overcomes hardness", // 柔よく剛を制す
  "jmdict-2646440": "there's luck in what is left over", // 残り物には福がある
  "jmdict-2666530": "you can't lay a quilt over a grave", // 墓に布団は着せられぬ
  "jmdict-2704870": "the crow that was crying is already laughing", // 今泣いた烏がもう笑う
  "jmdict-2719710": "I'd love to eat fugu, but I value my life", // ふぐは食いたし命は惜しし
  "jmdict-2721650": "parents meddling in their children's quarrels", // 子供の喧嘩に親が出る
  "jmdict-2738830": "the customer is god", // お客様は神様
  "jmdict-2757130": "guarded when questioned, a person gives it away while chatting", // 問うに落ちず語るに落ちる
  "jmdict-2766300": "a hundred days of sermons undone by a single fart", // 百日の説法屁一つ
  "jmdict-2779740": "bitten by a snake, you fear a rotten rope", // 蛇に噛まれて朽ち縄に怖じる
  "jmdict-2783090": "when in doubt, do not punish", // 疑わしきは罰せず
  "jmdict-2784400": "a crab digs a hole to fit its shell", // 蟹は甲羅に似せて穴を掘る
  "jmdict-2791100": "flatter a pig and even it will climb a tree", // 豚もおだてりゃ木に登る
  "jmdict-2791330": "even a sardine's head is holy to the faithful", // 鰯の頭も信心から
  "jmdict-2794850": "half a mat awake, one mat asleep: we need little", // 起きて半畳寝て一畳
  "jmdict-2828341": "among flowers the cherry, among men the samurai", // 花は桜木、人は武士
  "jmdict-2831326": "catching the thief, then braiding the rope", // 泥棒を捕らえて縄を綯う
  "jmdict-2832545": "one hand cannot clap", // 孤掌鳴らし難し
  "jmdict-2832594": "helping both behind the scenes and in the open", // 陰になり日向になり
  "jmdict-2832653": "ice and charcoal do not mix", // 氷炭相容れず
  "jmdict-2832736": "to sit on the fence", // 洞ヶ峠を決め込む
  "jmdict-2833900": "a tiger leaves its skin when it dies; a man leaves his name", // 虎は死して皮を留め人は死して名を残す
  "jmdict-2833938": "if you can't beat them, join them", // 長いものには巻かれろ
  "jmdict-2833951": "eating a bun in the privy (so as not to share)", // 雪隠で饅頭
  "jmdict-2833955": "every fine horse has its quirks", // 名馬に癖あり
  "jmdict-2833956": "no boar comes out bigger than the mountain", // 山より大きな猪は出ぬ
  "jmdict-2833961": "eat the plum but not the pit; Tenjin sleeps inside", // 梅は食うとも核食うな、中に天神寝てござる
  "jmdict-2834225": "sharing a tree's shade or a river's water is a bond from a past life", // 一樹の陰一河の流れも他生の縁
  "jmdict-2834228": "ride an ox until you can ride a horse", // 馬に乗るまでは牛に乗れ
  "jmdict-2834239": "the samurai, though unfed, still picks his teeth", // 武士は食わねど高楊枝
  "jmdict-2834245": "lose your boat midstream and a gourd is worth a fortune", // 中流に舟を失えば一壺も千金
  "jmdict-2834315": "wish for a pole, receive a needle", // 棒ほど願って針ほど叶う
  "jmdict-2834318": "two's company, three's a crowd", // 二人は伴侶、三人は仲間割れ
  "jmdict-2834319": "a conger's life or a shrimp's, each is one lifetime", // 鱧も一期、海老も一期
  "jmdict-2834320": "the full moon begins to wane", // 月満つれば則ち虧く
  "jmdict-2834360": "faith arises from splendor", // 信は荘厳より起こる
  "jmdict-2834361": "the silent firefly burns more than the singing cicada", // 鳴く蝉よりも鳴かぬ蛍が身を焦がす
  "jmdict-2834362": "a sturdy fence keeps the dogs out", // 垣堅くして犬入らず
  "jmdict-2834425": "even an ant's wish can reach heaven", // 蟻の思いも天に届く
  "jmdict-2834550": "how can swallows and sparrows know the swan's ambitions?", // 燕雀安んぞ鴻鵠の志を知らんや
  "jmdict-2834558": "the sweetest well runs dry first", // 甘井先ず竭く
  "jmdict-2834574": "learning without thought is confusion", // 学びて思わざれば則ち罔し
  "jmdict-2834583": "illness enters through the mouth, and misfortune leaves through it", // 病は口より入り禍は口より出ず
  "jmdict-2834652": "the fortune-teller cannot read his own fate", // 陰陽師身の上知らず
  "jmdict-2835662": "even in hell, not everyone is a demon", // 地獄にも鬼ばかりではない
  "jmdict-2835925": "the dog of worldly desire will not leave, however you chase it", // 煩悩の犬は追えども去らず
  "jmdict-2836094": "pride invites loss", // 満は損を招く
  "jmdict-2836752": "even if your parent dies, rest after a meal", // 親が死んでも食休み
  "jmdict-2837015": "a fleeing warrior is frightened by pampas plumes", // 落ち武者は薄の穂に怖ず
  "jmdict-2837023": "what happens to others today may happen to me tomorrow", // 明日は我が身
  "jmdict-2838426": "nuts fall at the foot of their tree", // 木の実は本へ落つ
  "jmdict-2839234": "even talking it over with your own knee helps", // 膝とも談合
  "jmdict-2841110": "the more foolish the child, the dearer", // 馬鹿な子ほど可愛い
  "jmdict-2841120": "drawing water from the same river is a bond from a past life", // 一河の流れを汲むも他生の縁
  "jmdict-2841341": "the country is broken, yet mountains and rivers remain", // 国破れて山河あり
  "jmdict-2842299": "the crane envies the tortoise its years", // 亀の年を鶴が羨む
  "jmdict-2842913": "digging a well once already thirsty", // 渇に臨みて井を穿つ
  "jmdict-2843322": "one falling leaf tells the world that autumn has come", // 一葉落ちて天下の秋を知る
  "jmdict-2843476": "in old age, even a kirin is outrun by a nag", // 麒麟も老いぬれば駑馬に劣る
  "jmdict-2844538": "good fortune comes all at once, when you can't enjoy it", // 貧僧の重ね斎
  "jmdict-2844713": "an emperor's word, like sweat, cannot be taken back", // 綸言汗の如し
  "jmdict-2844727": "even beans in the shade burst open in their time", // 陰裏の豆もはじけ時
  "jmdict-2845252": "no teetotaler ever built a storehouse", // 下戸の建てた蔵はない
  "jmdict-2845920": "kind words warm more than cloth", // 人に善言を与うるは布帛よりも煖かなり
  "jmdict-2847205": "fools and smoke both rise to high places", // 馬鹿と煙は高い所へ上る
  "jmdict-2848813": "you tire of a beauty in three days", // 美人は三日で飽きる
  "jmdict-2849008": "the riper the rice, the lower it bows its head", // 実るほど頭の下がる稲穂かな
  "jmdict-2850060": "blame the sake for my red face", // 赤きは酒の咎
  "jmdict-2850189": "friendship between the wise is as plain as water", // 君子の交わりは淡きこと水のごとし
  "jmdict-2851357": "heaven knows, earth knows, I know, and you know", // 天知る、地知る、我知る、子知る
  "jmdict-2854280": "lie down right after eating and you'll turn into a cow", // 食べてすぐ寝ると牛になる
  "jmdict-2856958": "check three times, then take your break", // 三遍回って煙草にしょ
  "jmdict-2859070": "the lion drops its cub into a deep ravine", // 獅子は我が子を千尋の谷に落とす
  "jmdict-2859193": "on a hundred-mile journey, ninety is the halfway point", // 百里を行く者は九十を半ばとす
  "jmdict-2860667": "children are children of the wind", // 子供は風の子
  "jmdict-2860668": "repay what you owe your parents by raising your own children", // 親の恩は子で送る
  "jmdict-2865116": "every little bit adds up", // ちりつも
  "jmdict-2867208": "an unpolished gem does not shine", // 玉磨かざれば光なし
  "jmdict-2868635": "no rain lasts forever", // 止まない雨はない
  "jmdict-2871253": "you can't make an omelet without breaking eggs", // 卵を割らずにオムレツは作れない
  "jmdict-1929200": "bad money drives out good", // 悪貨は良貨を駆逐する
  "jmdict-2123430": "of the thirty-six stratagems, running away is best", // 三十六計逃げるに如かず
  "jmdict-2833952": "one who knows contentment is rich", // 足るを知る者は富む
  // Translation review: four-character idioms
  "jmdict-1152160": "a hard, desperate struggle", // 悪戦苦闘
  "jmdict-1155130": "understanding from heart to heart, without words", // 以心伝心
  "jmdict-1156510": "hitting it off", // 意気投合
  "jmdict-1163610": "with single-minded devotion", // 一心不乱
  "jmdict-1164010": "with all one's might", // 一生懸命
  "jmdict-1164850": "in a single day", // 一朝一夕
  "jmdict-1165630": "resolving to make a fresh start", // 一念発起
  "jmdict-1166190": "the whole story, from beginning to end", // 一部始終
  "jmdict-1166740": "star attraction", // 一枚看板
  "jmdict-1173190": "vanishing like clouds and mist", // 雲散霧消
  "jmdict-1194810": "flowers, birds, wind and moon: the beauties of nature", // 花鳥風月
  "jmdict-1212320": "emotion too deep for words", // 感慨無量
  "jmdict-1218870": "joy, anger, sorrow and pleasure", // 喜怒哀楽
  "jmdict-1219430": "wildly imaginative", // 奇想天外
  "jmdict-1225600": "suspicion breeds imaginary demons", // 疑心暗鬼
  "jmdict-1228910": "a sudden turn of events", // 急転直下
  "jmdict-1258190": "scheming and intrigue", // 権謀術数
  "jmdict-1274860": "fair and aboveboard", // 公明正大
  "jmdict-1315850": "moment by moment", // 時々刻々
  "jmdict-1318770": "freely, at will", // 自由自在
  "jmdict-1334840": "ten people, ten colors", // 十人十色
  "jmdict-1335650": "in every direction, without limit", // 縦横無尽
  "jmdict-1377690": "legitimate self-defense", // 正当防衛
  "jmdict-1385250": "polishing each other through friendly rivalry", // 切磋琢磨
  "jmdict-1388840": "infinite variety", // 千差万別
  "jmdict-1407760": "great diversity", // 多種多様
  "jmdict-1428570": "orders given in the morning, changed by evening", // 朝令暮改
  "jmdict-1448200": "rushing about east and west", // 東奔西走
  // Translation review: idioms
  "jmdict-1229820": "a bee stinging a tearful face", // 泣き面に蜂
  "jmdict-1471580": "a sutra in a horse's ear", // 馬の耳に念仏
  "jmdict-1985200": "rice cakes falling from the shelf", // 棚から牡丹餅
  "jmdict-1177510": "beneath the floor, out of sight", // 縁の下
  "jmdict-1193680": "flames rising (of an attack or protest)", // 火の手
  "jmdict-1401920": "grassroots", // 草の根
  "jmdict-1407110": "a lesson learned from someone else's mistakes", // 他山の石
  "jmdict-1678830": "after the festival is over (too late)", // 後の祭り
  "jmdict-1000200": "perfect unspoken coordination between two people", // 阿吽の呼吸
  "jmdict-1255440": "as different as the moon and a turtle", // 月とスッポン
  "jmdict-1313060": "to grit one's teeth", // 歯を食いしばる
  "jmdict-1333160": "putting a lid on what stinks", // 臭いものに蓋
  "jmdict-1371290": "to throw cold water on", // 水を差す
  "jmdict-1373570": "a sparrow's tears: a tiny amount", // 雀の涙
};

/** The main collection followed by any additions (content/source/*.json beyond the main file). */
export function combineSources(main: SourceFile, ...additions: SourceFile[]): SourceFile {
  return { entries: [main, ...additions].flatMap((f) => f.entries) };
}

export function buildContent(
  source: SourceFile,
  scenery: Readonly<Record<string, Scenery>>,
  overrides: Readonly<Record<string, string>> = ENGLISH_OVERRIDES,
  lines: Readonly<Record<string, readonly string[]>> = {},
): Built {
  const ids = new Set<string>();
  for (const e of source.entries) {
    if (ids.has(e.id)) throw new Error(`duplicate id: ${e.id}`);
    ids.add(e.id);
  }
  for (const id of Object.keys(overrides)) {
    if (!ids.has(id)) throw new Error(`override for unknown id: ${id}`);
  }

  const texts: TextEntry[] = [];
  const index: IndexEntry[] = [];
  for (const e of source.entries) {
    const kind = KIND[e.type];
    if (!kind) throw new Error(`unknown type: ${e.type}`);
    const en = (overrides[e.id] ?? e.english).replace(/\besp\./g, "especially").trim();
    const entry: TextEntry = { id: e.id, kind, ja: e.japanese.trim(), en };
    if (kind === "haiku") {
      const poet = e.author ? POETS[e.author] : undefined;
      if (!poet) throw new Error(`haiku ${e.id} has an unknown poet: ${String(e.author)}`);
      entry.by = poet;
      const l = lines[e.id];
      if (!l || l.length !== 3 || l.join("") !== entry.ja) throw new Error(`haiku ${e.id} needs three lines that join to its text`);
      entry.lines = [l[0] as string, l[1] as string, l[2] as string];
      const s = scenery[e.id];
      if (!s) throw new Error(`haiku ${e.id} has no scenery tag`);
      const placed: IndexEntry = { id: e.id, kind, biome: s.biome, season: s.season, scene: s.scene };
      if (s.landmark) placed.landmark = s.landmark;
      index.push(placed);
    } else {
      index.push({ id: e.id, kind });
    }
    if (!entry.ja || !entry.en) throw new Error(`empty text: ${e.id}`);
    texts.push(entry);
  }
  for (const id of Object.keys(scenery)) {
    if (!ids.has(id)) throw new Error(`scenery for unknown id: ${id}`);
  }
  return { texts, index };
}
