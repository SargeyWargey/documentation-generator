import { FolderAnalyzer } from './FolderAnalyzer';

describe('FolderAnalyzer', () => {
  test('should create instance', () => {
    const analyzer = new FolderAnalyzer();
    expect(analyzer).toBeInstanceOf(FolderAnalyzer);
  });
});
