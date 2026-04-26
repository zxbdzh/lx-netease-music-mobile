import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: 380,
    maxWidth: '90%',
    maxHeight: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    fontSize: 14,
    color: '#999',
  },
  content: {
    padding: 16,
  },
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  songCover: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  songDetail: {
    flex: 1,
    marginLeft: 14,
  },
  songName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  singer: {
    fontSize: 13,
    color: '#999',
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 11,
    color: '#999',
  },
  likeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 87, 87, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 87, 0.2)',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  likeIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  likeContent: {
    flex: 1,
  },
  likeDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  likeDesc: {
    fontSize: 12,
    color: '#999',
  },
  loading: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    padding: 60,
    fontSize: 14,
    color: '#999',
  },
})
