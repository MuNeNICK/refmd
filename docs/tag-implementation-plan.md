# ドキュメントへのタグ機能実装設計

## 概要
既存のスクラップ投稿のタグ機能をドキュメントにも拡張し、統一的なタグ検索機能を実装する設計です。

## 現在のタグ実装の分析

### スクラップのタグ機能
- ハッシュタグ形式（#タグ名）でマークダウン内に記述
- 自動的に抽出・保存される
- クリックによるフィルタリング機能
- 使用回数の表示
- 未使用タグの自動削除

## データベース設計

### 新規テーブル
```sql
-- ドキュメントタグの関連テーブル
CREATE TABLE document_tags (
    document_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (document_id, tag_id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX idx_document_tags_document_id ON document_tags(document_id);
CREATE INDEX idx_document_tags_tag_id ON document_tags(tag_id);
```

### 既存テーブルの活用
- `tags`テーブル：スクラップと共通で使用
- タグの正規化（小文字化、トリム）は既存のトリガーを活用

## バックエンド実装

### 1. リポジトリ層の拡張

#### `tag.rs`の拡張
```rust
// ドキュメントのタグ更新
pub async fn update_document_tags(
    &self,
    document_id: i32,
    tag_names: Vec<String>,
) -> Result<()>

// タグによるドキュメント検索
pub async fn get_documents_by_tag(
    &self,
    tag_name: &str,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<Document>>

// 統合検索（ドキュメント＋スクラップ）
pub async fn search_by_tag(
    &self,
    tag_name: &str,
) -> Result<TagSearchResult>
```

### 2. サービス層の実装

#### `document_service.rs`の拡張
- ドキュメント作成・更新時にタグを抽出
- `TagParser`を使用してコンテンツからタグを解析
- タグの保存処理を追加

```rust
// ドキュメント保存時の処理
let tags = TagParser::extract_tags(&content);
tag_repository.update_document_tags(document_id, tags).await?;
```

### 3. API エンドポイント

#### 新規エンドポイント
- `GET /tags/{name}/documents` - タグによるドキュメント検索
- `GET /tags/{name}/all` - タグによる統合検索（ドキュメント＋スクラップ）
- `GET /documents/{id}/tags` - ドキュメントのタグ取得

#### レスポンス構造
```yaml
TagSearchResult:
  type: object
  properties:
    documents:
      type: array
      items:
        $ref: '#/components/schemas/Document'
    scrap_posts:
      type: array
      items:
        $ref: '#/components/schemas/ScrapPost'
```

## フロントエンド実装

### 1. ドキュメントプレビューでのタグ表示

#### コンポーネント構成
- `DocumentMarkdown`コンポーネントで`remark-hashtag`プラグインを有効化
- スクラップと同じタグスタイル（ピル型バッジ）を適用
- クリックハンドラーの実装

```tsx
// document-preview.tsx での実装
<DocumentMarkdown
  content={document.content}
  onTagClick={(tagName) => {
    // タグ検索画面への遷移
    router.push(`/search?tag=${tagName}`);
  }}
/>
```

### 2. タグ表示コンポーネントの共通化

既存の`ScrapTag`コンポーネントを汎用化：
```tsx
// components/common/Tag.tsx
export function Tag({ 
  name, 
  count, 
  onClick,
  variant = 'default' 
}: TagProps) {
  return (
    <Badge
      variant="secondary"
      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
      onClick={() => onClick?.(name)}
    >
      #{name} {count && `(${count})`}
    </Badge>
  );
}
```

### 3. 統合検索UI

#### 検索結果の表示
- タブによる切り替え（全て / ドキュメント / スクラップ）
- 各項目の種別表示（アイコンやラベル）
- 統一的なカード表示

```tsx
// components/search/TagSearchResults.tsx
<Tabs defaultValue="all">
  <TabsList>
    <TabsTrigger value="all">すべて</TabsTrigger>
    <TabsTrigger value="documents">ドキュメント</TabsTrigger>
    <TabsTrigger value="scraps">スクラップ</TabsTrigger>
  </TabsList>
  
  <TabsContent value="all">
    {/* ドキュメントとスクラップを混在表示 */}
  </TabsContent>
</Tabs>
```

## 実装手順

### フェーズ1：基盤整備
1. データベーススキーマの更新
2. バックエンドリポジトリ層の実装
3. APIエンドポイントの追加

### フェーズ2：ドキュメントタグ機能
1. ドキュメントサービスへのタグ抽出機能追加
2. ドキュメントプレビューでのタグ表示
3. タグクリックによる検索遷移

### フェーズ3：統合検索
1. 統合検索APIの実装
2. 検索UIの実装
3. フィルタリング機能の追加

## 技術的考慮事項

### パフォーマンス
- タグ抽出は非同期で実行
- 検索結果のページネーション
- タグカウントのキャッシュ

### 一貫性
- スクラップと同じタグパーサーを使用
- UIデザインの統一
- タグの正規化ルールの共通化

### 拡張性
- 将来的に他のコンテンツタイプにも対応可能
- タグの階層化やカテゴリ分けにも拡張可能

## セキュリティ
- タグ名のサニタイズ
- SQLインジェクション対策
- 権限に基づく検索結果のフィルタリング

## スクラップ内タグ一覧の改善

### 現状の問題
- スクラップ詳細画面でシステム全体のタグが表示される
- ドキュメントで使用されているタグも表示されてしまう
- ユーザーが関係ないタグを見ることで混乱する

### 解決策

#### 1. TagSearchコンポーネントの拡張
```tsx
interface TagSearchProps {
  // 既存のプロパティ
  onTagSelect?: (tagName: string) => void;
  selectedTags?: string[];
  onSelectedTagsChange?: (tags: string[]) => void;
  placeholder?: string;
  showPopular?: boolean;
  
  // 新規追加
  scrapId?: number;  // スクラップコンテキストでのタグ取得
}
```

#### 2. タグ取得ロジックの分岐
```tsx
const loadTags = useCallback(async () => {
  try {
    setIsLoading(true);
    
    if (scrapId) {
      // スクラップ固有のタグを取得
      const response = await client.tags.getScrapTags(scrapId);
      // TagWithCount形式に変換（カウントは表示しない）
      const tagsWithCount: TagWithCount[] = response.tags.map(tag => ({
        ...tag,
        count: 0  // スクラップ内では使用回数は不要
      }));
      setTags(tagsWithCount);
    } else {
      // 通常のシステム全体のタグを取得
      const response = await client.tags.listTags(20, 0);
      setTags(response.tags);
    }
  } catch (error) {
    console.error('Failed to load tags:', error);
    setTags([]);
  } finally {
    setIsLoading(false);
  }
}, [client.tags, scrapId]);
```

#### 3. スクラップページでの使用
```tsx
// app/scrap/[id]/page-client.tsx
<TagSearch
  selectedTags={selectedTags}
  onSelectedTagsChange={setSelectedTags}
  showPopular={true}
  scrapId={scrapId}  // スクラップIDを渡す
/>
```

### 実装の利点
- 既存のAPI `/tags/scraps/{id}/tags` を活用
- スクラップ外での使用は従来通り全タグを表示
- コンポーネントの後方互換性を維持
- パフォーマンスの向上（必要なタグのみ取得）

### 注意点
- スクラップ固有タグAPIはカウントを返さないため、UIで対応が必要
- 新規投稿で新しいタグを追加した際のリアルタイム更新の考慮
- タグ検索時もスクラップコンテキストを考慮する必要がある