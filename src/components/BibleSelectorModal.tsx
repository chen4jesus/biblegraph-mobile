import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BibleSelectorModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (book: string, chapter: number, verse: number) => void;
  onViewGraph: (selections: Array<{book: string, chapter: number, verse: number}>) => void;
}

// Define Bible structure with chapter counts
const OLD_TESTAMENT = [
  { name: '创', fullName: '创世记', chapters: 50, englishName: 'Genesis' },
  { name: '出', fullName: '出埃及记', chapters: 40, englishName: 'Exodus' },
  { name: '利', fullName: '利未记', chapters: 27, englishName: 'Leviticus' },
  { name: '民', fullName: '民数记', chapters: 36, englishName: 'Numbers' },
  { name: '申', fullName: '申命记', chapters: 34, englishName: 'Deuteronomy' },
  { name: '书', fullName: '约书亚记', chapters: 24, englishName: 'Joshua' },
  { name: '士', fullName: '士师记', chapters: 21, englishName: 'Judges' },
  { name: '得', fullName: '路得记', chapters: 4, englishName: 'Ruth' },
  { name: '撒上', fullName: '撒母耳记上', chapters: 31, englishName: '1 Samuel' },
  { name: '撒下', fullName: '撒母耳记下', chapters: 24, englishName: '2 Samuel' },
  { name: '王上', fullName: '列王纪上', chapters: 22, englishName: '1 Kings' },
  { name: '王下', fullName: '列王纪下', chapters: 25, englishName: '2 Kings' },
  { name: '代上', fullName: '历代志上', chapters: 29, englishName: '1 Chronicles' },
  { name: '代下', fullName: '历代志下', chapters: 36, englishName: '2 Chronicles' },
  { name: '拉', fullName: '以斯拉记', chapters: 10, englishName: 'Ezra' },
  { name: '尼', fullName: '尼希米记', chapters: 13, englishName: 'Nehemiah' },
  { name: '斯', fullName: '以斯帖记', chapters: 10, englishName: 'Esther' },
  { name: '伯', fullName: '约伯记', chapters: 42, englishName: 'Job' },
  { name: '诗', fullName: '诗篇', chapters: 150, englishName: 'Psalm' },
  { name: '箴', fullName: '箴言', chapters: 31, englishName: 'Proverbs' },
  { name: '传', fullName: '传道书', chapters: 12, englishName: 'Ecclesiastes' },
  { name: '歌', fullName: '雅歌', chapters: 8, englishName: 'Song of Solomon' },
  { name: '赛', fullName: '以赛亚书', chapters: 66, englishName: 'Isaiah' },
  { name: '耶', fullName: '耶利米书', chapters: 52, englishName: 'Jeremiah' },
  { name: '哀', fullName: '耶利米哀歌', chapters: 5, englishName: 'Lamentations' },
  { name: '结', fullName: '以西结书', chapters: 48, englishName: 'Ezekiel' },
  { name: '但', fullName: '但以理书', chapters: 12, englishName: 'Daniel' },
  { name: '何', fullName: '何西阿书', chapters: 14, englishName: 'Hosea' },
  { name: '珥', fullName: '约珥书', chapters: 3, englishName: 'Joel' },
  { name: '摩', fullName: '阿摩司书', chapters: 9, englishName: 'Amos' },
  { name: '俄', fullName: '俄巴底亚书', chapters: 1, englishName: 'Obadiah' },
  { name: '拿', fullName: '约拿书', chapters: 4, englishName: 'Jonah' },
  { name: '弥', fullName: '弥迦书', chapters: 7, englishName: 'Micah' },
  { name: '鸿', fullName: '那鸿书', chapters: 3, englishName: 'Nahum' },
  { name: '哈', fullName: '哈巴谷书', chapters: 3, englishName: 'Habakkuk' },
  { name: '番', fullName: '西番雅书', chapters: 3, englishName: 'Zephaniah' },
  { name: '该', fullName: '哈该书', chapters: 2, englishName: 'Haggai' },
  { name: '亚', fullName: '撒迦利亚书', chapters: 14, englishName: 'Zechariah' },
  { name: '玛', fullName: '玛拉基书', chapters: 4, englishName: 'Malachi' },
];

const NEW_TESTAMENT = [
  { name: '太', fullName: '马太福音', chapters: 28, englishName: 'Matthew' },
  { name: '可', fullName: '马可福音', chapters: 16, englishName: 'Mark' },
  { name: '路', fullName: '路加福音', chapters: 24, englishName: 'Luke' },
  { name: '约', fullName: '约翰福音', chapters: 21, englishName: 'John' },
  { name: '徒', fullName: '使徒行传', chapters: 28, englishName: 'Acts' },
  { name: '罗', fullName: '罗马书', chapters: 16, englishName: 'Romans' },
  { name: '林前', fullName: '哥林多前书', chapters: 16, englishName: '1 Corinthians' },
  { name: '林后', fullName: '哥林多后书', chapters: 13, englishName: '2 Corinthians' },
  { name: '加', fullName: '加拉太书', chapters: 6, englishName: 'Galatians' },
  { name: '弗', fullName: '以弗所书', chapters: 6, englishName: 'Ephesians' },
  { name: '腓', fullName: '腓立比书', chapters: 4, englishName: 'Philippians' },
  { name: '西', fullName: '歌罗西书', chapters: 4, englishName: 'Colossians' },
  { name: '帖前', fullName: '帖撒罗尼迦前书', chapters: 5, englishName: '1 Thessalonians' },
  { name: '帖后', fullName: '帖撒罗尼迦后书', chapters: 3, englishName: '2 Thessalonians' },
  { name: '提前', fullName: '提摩太前书', chapters: 6, englishName: '1 Timothy' },
  { name: '提后', fullName: '提摩太后书', chapters: 4, englishName: '2 Timothy' },
  { name: '多', fullName: '提多书', chapters: 3, englishName: 'Titus' },
  { name: '门', fullName: '腓利门书', chapters: 1, englishName: 'Philemon' },
  { name: '来', fullName: '希伯来书', chapters: 13, englishName: 'Hebrews' },
  { name: '雅', fullName: '雅各书', chapters: 5, englishName: 'James' },
  { name: '彼前', fullName: '彼得前书', chapters: 5, englishName: '1 Peter' },
  { name: '彼后', fullName: '彼得后书', chapters: 3, englishName: '2 Peter' },
  { name: '约一', fullName: '约翰一书', chapters: 5, englishName: '1 John' },
  { name: '约二', fullName: '约翰二书', chapters: 1, englishName: '2 John' },
  { name: '约三', fullName: '约翰三书', chapters: 1, englishName: '3 John' },
  { name: '犹', fullName: '犹大书', chapters: 1, englishName: 'Jude' },
  { name: '启', fullName: '启示录', chapters: 22, englishName: 'Revelation' },
];

const VERSE_COUNTS = {
  // This is a simplified mapping - many chapters have varying verse counts
  // For a complete implementation, this would need to be a nested object with every chapter's verse count
  // Example below for Genesis
  'Genesis': {
    1: 31, 2: 25, 3: 24, 4: 26, 5: 32, // and so on
  }
};

type VerseSelection = {
  book: string;
  chapter: number;
  verse: number;
  englishBook: string;
};

const BibleSelectorModal: React.FC<BibleSelectorModalProps> = ({
  isVisible,
  onClose,
  onSelect,
  onViewGraph,
}) => {
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [view, setView] = useState<'books' | 'chapters' | 'verses'>('books');
  const [selectedVerses, setSelectedVerses] = useState<VerseSelection[]>([]);
  
  // Current book details for displaying chapters and verses
  const currentBook = useMemo(() => {
    if (!selectedBook) return null;
    
    const oldTestamentBook = OLD_TESTAMENT.find(book => book.name === selectedBook);
    if (oldTestamentBook) return oldTestamentBook;
    
    const newTestamentBook = NEW_TESTAMENT.find(book => book.name === selectedBook);
    return newTestamentBook || null;
  }, [selectedBook]);

  const resetSelection = () => {
    setSelectedBook(null);
    setSelectedChapter(null);
    setView('books');
  };

  const handleBookSelect = (book: string) => {
    setSelectedBook(book);
    setView('chapters');
  };

  const handleChapterSelect = (chapter: number) => {
    setSelectedChapter(chapter);
    setView('verses');
  };

  const handleVerseSelect = (verse: number) => {
    if (selectedBook && selectedChapter && currentBook) {
      // Check if verse is already selected
      const verseKey = `${currentBook.englishName}-${selectedChapter}-${verse}`;
      const isSelected = selectedVerses.some(
        v => v.englishBook === currentBook.englishName && 
             v.chapter === selectedChapter && 
             v.verse === verse
      );
      
      if (isSelected) {
        // Remove from selection
        setSelectedVerses(selectedVerses.filter(
          v => !(v.englishBook === currentBook.englishName && 
                v.chapter === selectedChapter && 
                v.verse === verse)
        ));
      } else {
        // Add to selection
        setSelectedVerses([
          ...selectedVerses,
          {
            book: currentBook.fullName,
            englishBook: currentBook.englishName,
            chapter: selectedChapter,
            verse: verse
          }
        ]);
      }
      
      // When selecting a single verse, also support the original behavior
      if (!isSelected && selectedVerses.length === 0) {
        onSelect(currentBook.englishName, selectedChapter, verse);
      }
    }
  };

  const handleViewGraph = () => {
    if (selectedVerses.length > 0) {
      console.log('BibleSelectorModal - Selected verses for graph:', selectedVerses);
      onViewGraph(selectedVerses.map(v => ({
        book: v.englishBook,
        chapter: v.chapter,
        verse: v.verse,
        // Also pass the Chinese name as backup
        chineseBook: v.book
      })));
      resetSelection();
      onClose();
    }
  };

  const renderBookItem = ({ item }: { item: typeof OLD_TESTAMENT[0] }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => handleBookSelect(item.name)}
    >
      <Text style={styles.itemText}>{item.name}</Text>
      <Text style={styles.itemSubtext}>{item.fullName}</Text>
    </TouchableOpacity>
  );

  const renderChapterItem = ({ item }: { item: number }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => handleChapterSelect(item)}
    >
      <Text style={styles.itemText}>{item}</Text>
    </TouchableOpacity>
  );

  const renderVerseItem = ({ item }: { item: number }) => {
    const isSelected = currentBook && selectedVerses.some(
      v => v.englishBook === currentBook.englishName && 
           v.chapter === selectedChapter && 
           v.verse === item
    );
    
    return (
      <TouchableOpacity
        style={[
          styles.item,
          isSelected && styles.selectedItem
        ]}
        onPress={() => handleVerseSelect(item)}
      >
        <Text style={[
          styles.itemText,
          isSelected && styles.selectedItemText
        ]}>{item}</Text>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    switch (view) {
      case 'books':
        return (
          <>
            <Text style={styles.sectionTitle}>旧约</Text>
            <FlatList
              data={OLD_TESTAMENT}
              renderItem={renderBookItem}
              keyExtractor={(item) => item.name}
              numColumns={4}
              style={styles.list}
            />
            <Text style={styles.sectionTitle}>新约</Text>
            <FlatList
              data={NEW_TESTAMENT}
              renderItem={renderBookItem}
              keyExtractor={(item) => item.name}
              numColumns={4}
              style={styles.list}
            />
          </>
        );
      case 'chapters':
        return (
          <FlatList
            data={currentBook ? Array.from({ length: currentBook.chapters }, (_, i) => i + 1) : []}
            renderItem={renderChapterItem}
            keyExtractor={(item) => item.toString()}
            numColumns={4}
            style={styles.list}
          />
        );
      case 'verses':
        // For this simplified version, we'll use a default verse count of 30
        // In a full implementation, the actual verse count would be based on book+chapter
        const verseCount = 30;
        return (
          <>
            <FlatList
              data={Array.from({ length: verseCount }, (_, i) => i + 1)}
              renderItem={renderVerseItem}
              keyExtractor={(item) => item.toString()}
              numColumns={4}
              style={styles.list}
            />
            {selectedVerses.length > 0 && (
              <View style={styles.selectedVersesContainer}>
                <Text style={styles.selectedVersesTitle}>
                  已选择 ({selectedVerses.length})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedVerses.map((verse, index) => (
                    <View key={index} style={styles.selectedVerseTag}>
                      <Text style={styles.selectedVerseTagText}>
                        {verse.book} {verse.chapter}:{verse.verse}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedVerses(selectedVerses.filter((_, i) => i !== index));
                        }}
                        style={styles.removeButton}
                      >
                        <Ionicons name="close-circle" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.viewGraphButton}
                  onPress={handleViewGraph}
                >
                  <Text style={styles.viewGraphButtonText}>查看图表</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        );
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (view === 'books') {
                onClose();
                resetSelection();
              } else if (view === 'chapters') {
                setView('books');
                setSelectedBook(null);
              } else {
                setView('chapters');
                setSelectedChapter(null);
              }
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {view === 'books'
              ? '选择经卷 (CUV)'
              : view === 'chapters'
              ? `${currentBook?.fullName || selectedBook} (CUV) - 选择章`
              : `${currentBook?.fullName || selectedBook} ${selectedChapter} (CUV) - 选择节`}
          </Text>
          <TouchableOpacity onPress={() => {
            resetSelection();
            setSelectedVerses([]);
            onClose();
          }} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.content}>{renderContent()}</View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 8,
    color: '#666',
  },
  list: {
    flex: 1,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    margin: 4,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    minWidth: 80,
  },
  selectedItem: {
    backgroundColor: '#007AFF',
  },
  itemText: {
    fontSize: 16,
    color: '#000',
  },
  selectedItemText: {
    color: '#fff',
  },
  itemSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  selectedVersesContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  selectedVersesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  selectedVerseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedVerseTagText: {
    color: '#fff',
    fontSize: 12,
    marginRight: 4,
  },
  removeButton: {
    padding: 2,
  },
  viewGraphButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  viewGraphButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BibleSelectorModal; 