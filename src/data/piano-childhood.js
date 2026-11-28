// Traditional and public-domain melodies for the C4–C5 keyboard.
// Durations are in quarter-note units in every metre, including 6/8.
export const CHILDHOOD_PIANO = [
  // Credited to Eliphalet Oram Lyte, The Franklin Square Song Collection (1881), p. 69.
  // https://www.themorgan.org/music-manuscripts-and-printed-music/311191
  [{ id: 'row-row-row-your-boat', name: 'Row, Row, Row Your Boat', level: 1, xp: 18, bpm: 126, beatsPerBar: 3, timeSignature: [6, 8], keySignature: 'C' }, [
    [[60, 1.5], [60, 1.5]],
    [60, [62, 0.5], [64, 1.5]],
    [64, [62, 0.5], 64, [65, 0.5]],
    [[67, 3]],
    [[72, 0.5], [72, 0.5], [72, 0.5], [67, 0.5], [67, 0.5], [67, 0.5]],
    [[64, 0.5], [64, 0.5], [64, 0.5], [60, 0.5], [60, 0.5], [60, 0.5]],
    [67, [65, 0.5], 64, [62, 0.5]],
    [[60, 3]],
  ]],
  // William B. Bradbury, The Golden Shower (1862). Verse and refrain.
  // https://hymnary.org/tune/jesus_loves_me_this_i_know_bradbury
  [{ id: 'jesus-loves-me', name: 'Jesus Loves Me', level: 1, xp: 34, bpm: 100, beatsPerBar: 4, keySignature: 'C' }, [
    [67, 64, 64, 62],
    [64, 67, [67, 2]],
    [69, 69, 72, 69],
    [69, 67, [67, 2]],
    [67, 64, 64, 62],
    [64, 67, [67, 2]],
    [69, 69, 67, 60],
    [64, 62, [60, 2]],
    [[67, 2], 64, 67],
    [69, [72, 3]],
    [[67, 2], 64, 60],
    [64, [62, 3]],
    [[67, 2], 64, 67],
    [69, [72, 2], 69],
    [67, 60, [64, 1.5], [62, 0.5]],
    [[60, 4]],
  ]],
  // French round attributed to Rameau. The low dominant in the bell figure is raised an octave.
  // https://imslp.org/wiki/Fr%C3%A8re_Jacques_(Rameau,_Jean-Philippe)
  [{ id: 'frere-jacques', name: 'Frère Jacques', level: 2, xp: 22, bpm: 100, beatsPerBar: 4, keySignature: 'C' }, [
    [60, 62, 64, 60],
    [60, 62, 64, 60],
    [64, 65, [67, 2]],
    [64, 65, [67, 2]],
    [[67, 0.5], [69, 0.5], [67, 0.5], [65, 0.5], 64, 60],
    [[67, 0.5], [69, 0.5], [67, 0.5], [65, 0.5], 64, 60],
    [60, 67, [60, 2]],
    [60, 67, [60, 2]],
  ]],
  // Traditional English melody, printed in Song Collection for Use in Summer Schools (1920).
  // https://archive.org/details/songcollectionfo1920nort
  [{ id: 'london-bridge', name: 'London Bridge Is Falling Down', level: 3, xp: 22, bpm: 100, beatsPerBar: 4, keySignature: 'C' }, [
    [[67, 1.5], [69, 0.5], 67, 65],
    [64, 65, [67, 2]],
    [62, 64, [65, 2]],
    [64, 65, [67, 2]],
    [[67, 1.5], [69, 0.5], 67, 65],
    [64, 65, [67, 2]],
    [[62, 2], [67, 2]],
    [64, [60, 3]],
  ]],
  // Traditional tune. For a G-major reading, see The Public Domain Song Anthology, p. 237.
  // https://learntoplayrecorder.com/songs/book1/chapter2/old-macdonald
  // Holds take the place of breathing rests in this continuous practice arrangement.
  [{ id: 'old-macdonald', name: 'Old MacDonald Had a Farm', level: 5, xp: 35, bpm: 112, beatsPerBar: 4, keySignature: 'G' }, [
    [67, 67, 67, 62],
    [64, 64, [62, 2]],
    [71, 71, 69, 69],
    [[67, 3], 62],
    [67, 67, 67, 62],
    [64, 64, [62, 2]],
    [71, 71, 69, 69],
    [[67, 3], [62, 0.5], [62, 0.5]],
    [67, 67, 67, [62, 0.5], [62, 0.5]],
    [67, 67, 67, [67, 0.5], [67, 0.5]],
    [67, [67, 0.5], [67, 0.5], 67, [67, 0.5], [67, 0.5]],
    [[67, 0.5], [67, 0.5], 67, 67, 67],
    [67, 67, 67, 62],
    [64, 64, [62, 2]],
    [71, 71, 69, 69],
    [[67, 4]],
  ]],
  // Mildred and Patty Hill, Song Stories for the Kindergarten (1893), Good Morning to All.
  // https://imslp.org/wiki/Happy_Birthday_to_You_(Hill,_Mildred)
  [{ id: 'happy-birthday', name: 'Happy Birthday to You', level: 6, xp: 24, bpm: 112, beatsPerBar: 3, keySignature: 'F' }, [
    [[60, 0.5], [60, 0.5]],
    [62, 60, 65],
    [[64, 2], [60, 0.5], [60, 0.5]],
    [62, 60, 67],
    [[65, 2], [60, 0.5], [60, 0.5]],
    [72, 69, 65],
    [64, 62, [70, 0.5], [70, 0.5]],
    [69, 65, 67],
    [[65, 2]],
  ]],
  // James Lord Pierpont, The One Horse Open Sleigh (1857). Today's full chorus.
  // https://levysheetmusic.mse.jhu.edu/collection/062/029
  [{ id: 'jingle-bells-chorus', name: 'Jingle Bells (Chorus)', level: 8, xp: 38, bpm: 116, beatsPerBar: 4, keySignature: 'C' }, [
    [64, 64, [64, 2]],
    [64, 64, [64, 2]],
    [64, 67, [60, 1.5], [62, 0.5]],
    [[64, 4]],
    [65, 65, [65, 1.5], [65, 0.5]],
    [65, 64, 64, [64, 0.5], [64, 0.5]],
    [64, 62, 62, 64],
    [[62, 2], [67, 2]],
    [64, 64, [64, 2]],
    [64, 64, [64, 2]],
    [64, 67, [60, 1.5], [62, 0.5]],
    [[64, 4]],
    [65, 65, [65, 1.5], [65, 0.5]],
    [65, 64, 64, [64, 0.5], [64, 0.5]],
    [67, 67, 65, 62],
    [[60, 4]],
  ]],
  // Traditional singing game. The Everyday Song Book (1927), The Mulberry Bush.
  // https://trillian.mit.edu/~jc/music/book/EverydaySongBook/EverydaySongBook2.abc
  [{ id: 'mulberry-bush', name: 'Here We Go Round the Mulberry Bush', level: 10, xp: 30, bpm: 116, beatsPerBar: 3, timeSignature: [6, 8], keySignature: 'F' }, [
    [[65, 0.5], [65, 0.5], [65, 0.5], 65, [69, 0.5]],
    [72, [69, 0.25], [69, 0.25], 65, [69, 0.5]],
    [67, [67, 0.25], [67, 0.25], 67, [65, 0.5]],
    [64, [62, 0.25], [62, 0.25], [60, 1.5]],
    [[65, 0.5], [65, 0.5], [65, 0.5], 65, [69, 0.5]],
    [72, [69, 0.25], [69, 0.25], 65, [69, 0.5]],
    [67, [67, 0.5], [60, 0.5], [62, 0.5], [64, 0.5]],
    [[65, 1.5], [65, 1.5]],
  ]],

  // Hot Cross Buns and Rain, Rain, Go Away: Music and the Child, chapter 8.
  // https://milnepublishing.geneseo.edu/music-and-the-child/chapter/chapter-8/
  [{ id: 'hot-cross-buns', name: 'Hot Cross Buns', level: 1, xp: 12, bpm: 88, beatsPerBar: 4, keySignature: 'C' }, [
    [64, 62, [60, 2]],
    [64, 62, [60, 2]],
    [[60, 0.5], [60, 0.5], [60, 0.5], [60, 0.5], [62, 0.5], [62, 0.5], [62, 0.5], [62, 0.5]],
    [64, 62, [60, 2]],
  ]],
  [{ id: 'rain-rain-go-away', name: 'Rain, Rain, Go Away', level: 2, xp: 14, bpm: 94, beatsPerBar: 2, keySignature: 'C' }, [
    [67, 64],
    [[67, 0.5], [67, 0.5], 64],
    [[67, 0.5], [67, 0.5], [64, 0.5], [69, 0.5]],
    [[67, 0.5], [67, 0.5], 64],
  ]],
  // The traditional British singing-game melody.
  // https://www.mfiles.co.uk/scores/ring-a-ring-o-roses.htm
  [{ id: 'ring-a-ring-o-roses', name: "Ring a Ring o' Roses", level: 4, xp: 21, bpm: 96,
    beatsPerBar: 3, timeSignature: [6, 8], keySignature: 'C' }, [
    [67, [67, 0.5], 64, [69, 0.5]],
    [[67, 1.5], 64, [65, 0.5]],
    [67, [67, 0.5], 64, [69, 0.5]],
    [[67, 1.5], 64, [67, 0.5]],
    [[72, 1.5], 67, [67, 0.5]],
    [[72, 1.5], 67, [65, 0.5]],
    [[64, 1.5], [62, 1.5]],
    [[60, 3]],
  ]],
  // Traditional English melody, adapted with even eighths.
  // https://www.flutetunes.com/tunes.php?id=5436
  [{ id: 'muffin-man', name: 'The Muffin Man', level: 5, xp: 24, bpm: 92, beatsPerBar: 2, keySignature: 'F' }, [
    [[60, 0.5], [65, 0.5], [65, 0.5], [67, 0.5]],
    [[69, 0.5], [65, 0.5], [65, 0.5], [65, 0.5]],
    [[62, 0.5], [67, 0.5], [67, 0.5], [65, 0.5]],
    [[64, 0.5], [60, 0.5], 60],
    [[60, 0.5], [65, 0.5], [65, 0.5], [67, 0.5]],
    [[69, 0.5], [65, 0.5], [65, 0.5], [65, 0.5]],
    [[62, 0.5], [67, 0.5], [65, 0.5], [64, 0.5]],
    [[65, 2]],
  ]],
  // One full sung verse, with the opening pickup balanced by the final bar.
  // https://trillian.mit.edu/~jc/music/abc/mirror/gulfweb.net:34043/~rlwalker/abc/bingo.abc
  [{ id: 'bingo', name: 'BINGO', level: 7, xp: 33, bpm: 108, beatsPerBar: 4, keySignature: 'F' }, [
    [60],
    [65, 65, 60, 60],
    [62, 62, 60, 60],
    [65, 65, 67, 67],
    [[69, 2], [65, 2]],
    [[69, 2], [69, 2]],
    [70, 70, [70, 2]],
    [[67, 2], [67, 2]],
    [69, 69, [69, 2]],
    [[65, 2], [65, 2]],
    [67, 67, 67, 65],
    [64, 60, 62, 64],
    [[65, 2], 65],
  ]],
  // The sung strain from Ryan's Mammoth Collection (1883).
  // https://trillian.mit.edu/~jc/music/book/ryan-cole/Tunes/PopGoesTheWeasel.abc
  [{ id: 'pop-goes-the-weasel', name: 'Pop Goes the Weasel', level: 9, xp: 38, bpm: 102,
    beatsPerBar: 3, timeSignature: [6, 8], keySignature: 'C' }, [
    [60, [60, 0.5], 62, [62, 0.5]],
    [[64, 0.5], [67, 0.5], [64, 0.5], [60, 1.5]],
    [60, [60, 0.5], 62, [65, 0.5]],
    [[64, 1.5], [60, 1.5]],
    [60, [60, 0.5], 62, [62, 0.5]],
    [[64, 0.5], [67, 0.5], [64, 0.5], [60, 1.5]],
    [[69, 1.5], 62, [65, 0.5]],
    [[64, 1.5], [60, 1.5]],
  ]],
  // The traditional round, with the shortest repeated notes simplified.
  // https://trillian.mit.edu/~jc/music/abc/mirror/back.numachi.com/Three_Blind_Mice.abc
  [{ id: 'three-blind-mice', name: 'Three Blind Mice', level: 11, xp: 40, bpm: 96,
    beatsPerBar: 3, timeSignature: [6, 8], keySignature: 'C' }, [
    [[64, 1.5], [62, 1.5]],
    [[60, 3]],
    [[64, 1.5], [62, 1.5]],
    [[60, 3]],
    [[67, 1.5], 65, [65, 0.5]],
    [[64, 3]],
    [[67, 1.5], 65, [65, 0.5]],
    [[64, 2], 67],
    [72, [72, 0.5], [71, 0.5], [69, 0.5], [71, 0.5]],
    [72, [67, 0.5], 67, [67, 0.5]],
    [[72, 0.5], [72, 0.5], [72, 0.5], [71, 0.5], [69, 0.5], [71, 0.5]],
    [72, [67, 0.5], 67, [67, 0.5]],
    [72, [72, 0.5], [71, 0.5], [69, 0.5], [71, 0.5]],
    [[72, 0.5], [67, 0.5], [67, 0.5], 67, [65, 0.5]],
    [[64, 1.5], [62, 1.5]],
    [[60, 3]],
  ]],

  // Traditional English counting song. Melody cross-checked against the Musica Viva ABC.
  // https://trillian.mit.edu/~jc/music/abc/mirror/musicaviva.com/tunes/anon/this-old-man/this-old-man-1.abc
  [{ id: 'this-old-man', name: 'This Old Man', level: 2, xp: 21, bpm: 98, beatsPerBar: 4, keySignature: 'C' }, [
    [67, 64, [67, 2]],
    [67, 64, [67, 2]],
    [69, 67, 65, 64],
    [62, 64, 65, [64, 0.5], [65, 0.5]],
    [67, 60, [60, 0.5], [60, 0.5], 60],
    [[60, 0.5], [62, 0.5], [64, 0.5], [65, 0.5], [67, 2]],
    [67, 62, 62, 65],
    [64, 62, [60, 2]],
  ]],
  // J. W. Elliott, National Nursery Rhymes and Nursery Songs, p. 7 (c. 1870).
  // The sustained notes fill pauses from the voice part of Elliott's "Dickory, Dickory, Dock".
  [{ id: 'hickory-dickory-dock', name: 'Hickory Dickory Dock', level: 4, xp: 22, bpm: 111, beatsPerBar: 3, timeSignature: [6, 8], keySignature: 'C' }, [
    [[64, 0.5], [65, 0.5], [67, 0.5], [65, 0.5], [64, 0.5], [62, 0.5]],
    [[64, 2], 64],
    [64, [67, 0.5], 65, [62, 0.5]],
    [[64, 2], 64],
    [64, [64, 0.5], 67, [67, 0.5]],
    [65, [65, 0.5], [69, 1.5]],
    [[67, 0.5], [69, 0.5], [67, 0.5], [65, 0.5], [64, 0.5], [62, 0.5]],
    [[60, 3]],
  ]],
  // Elliott, National Nursery Rhymes and Nursery Songs, p. 24. Transposed from G to F.
  [{ id: 'see-saw-margery-daw', name: 'See-Saw, Margery Daw', level: 5, xp: 24, bpm: 112, beatsPerBar: 3, timeSignature: [6, 8], keySignature: 'F' }, [
    [[65, 1.5], [60, 1.5]],
    [[65, 0.5], [65, 0.5], [65, 0.5], [60, 1.5]],
    [65, [65, 0.5], [65, 0.5], [65, 0.5], [65, 0.5]],
    [[69, 1.5], [67, 1.5]],
    [65, [65, 0.5], [60, 0.5], [60, 0.5], [60, 0.5]],
    [[65, 0.5], [65, 0.5], [65, 0.5], 60, [60, 0.5]],
    [[69, 0.5], [69, 0.5], [69, 0.5], [72, 0.5], [70, 0.5], [67, 0.5]],
    [[64, 1.5], [65, 1.5]],
  ]],
  // Elliott, National Nursery Rhymes and Nursery Songs, p. 30.
  // Transposed from D to C. The single note below the keyboard is raised an octave.
  [{ id: 'humpty-dumpty', name: 'Humpty Dumpty', level: 7, xp: 26, bpm: 114, beatsPerBar: 3, timeSignature: [6, 8], keySignature: 'C' }, [
    [67, [72, 0.5], 64, [67, 0.5]],
    [[60, 0.5], [62, 0.5], [64, 0.5], [62, 1.5]],
    [65, [69, 0.5], 62, [65, 0.5]],
    [[71, 0.5], [64, 0.5], [62, 0.5], [60, 1.5]],
    [[64, 0.5], [65, 0.5], [67, 0.5], [69, 0.5], [67, 0.5], [65, 0.5]],
    [[64, 0.5], [65, 0.5], [67, 0.5], [69, 1.5]],
    [[60, 0.5], [60, 0.5], [60, 0.5], 62, [62, 0.5]],
    [[64, 1.5], 65, [65, 0.5]],
    [[67, 2], [62, 0.5], [64, 0.5]],
    [[60, 3]],
  ]],
  // Traditional American play-party song. Refrain in Pitch that Rhythm, p. 24, transposed to F.
  // https://www.qcaa.qld.edu.au/downloads/p_10/kla_arts_sbm_mu_402.pdf
  [{ id: 'skip-to-my-lou', name: 'Skip to My Lou', level: 8, xp: 25, bpm: 98, beatsPerBar: 2, keySignature: 'F' }, [
    [69, 65],
    [[69, 0.5], [69, 0.25], [69, 0.25], 72],
    [67, 64],
    [[67, 0.5], [67, 0.25], [67, 0.25], 70],
    [69, 65],
    [[69, 0.5], [69, 0.25], [69, 0.25], 72],
    [[67, 0.5], [69, 0.25], [70, 0.25], [69, 0.5], [67, 0.5]],
    [65, 65],
  ]],
  // Traditional Malay Archipelago song, familiar in Singapore. Complete refrain from
  // Krontjong-Liederen (1925), p. 11, transposed to C with even sixteenths on repeated notes.
  // https://commons.wikimedia.org/wiki/File:Music_Sheet_of_Rasa_Sajang_E.png
  [{ id: 'rasa-sayang', name: 'Rasa Sayang', level: 12, xp: 32, bpm: 102, beatsPerBar: 2, keySignature: 'C' }, [
    [[60, 0.5], [64, 0.5]],
    [67, 67],
    [72, [71, 0.5], [69, 0.5]],
    [[67, 0.5], [67, 0.5], [64, 0.5], [65, 0.5]],
    [67, 71],
    [[69, 0.5], [69, 0.25], [69, 0.25], [65, 0.5], [69, 0.5]],
    [[67, 0.5], [67, 0.5], [72, 0.5], [72, 0.5]],
    [[71, 0.5], [69, 0.5], [67, 0.5], [71, 0.5]],
    [72, [60, 0.5], [64, 0.5]],
    [67, 67],
    [72, [71, 0.5], [69, 0.5]],
    [[67, 0.5], [67, 0.5], [64, 0.5], [65, 0.5]],
    [67, 71],
    [[69, 0.5], [69, 0.25], [69, 0.25], [65, 0.5], [69, 0.5]],
    [[67, 0.5], [67, 0.5], [72, 0.5], [72, 0.5]],
    [[71, 0.5], [69, 0.5], [67, 0.5], [71, 0.5]],
    [[72, 2]],
  ]],
];
