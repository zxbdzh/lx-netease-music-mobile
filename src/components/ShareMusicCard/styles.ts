import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: 360,
    maxWidth: '90%',
    maxHeight: '90%',
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
    color: '#07c560',
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
  contentContainer: {
    alignItems: 'center',
  },
  viewShot: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  styleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  styleOption: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  styleOptionActive: {
    borderColor: '#07c560',
  },
  styleOptionText: {
    fontSize: 12,
    color: '#999',
  },
  styleOptionTextActive: {
    color: '#07c560',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  shareButton: {
    backgroundColor: '#07c560',
  },
  cancelButton: {
    backgroundColor: '#2a2a2a',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  shareButtonText: {
    color: '#fff',
  },
  cancelButtonText: {
    color: '#999',
  },
})
