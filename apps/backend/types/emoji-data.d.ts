declare module "emoji-data" {
  interface EmojiData {
    char: string;
    name: string;
    category: string;
    short_names?: string[];
  }

  interface EmojiDataModule {
    all(): EmojiData[];
  }

  const emojiData: EmojiDataModule;
  export default emojiData;
}
