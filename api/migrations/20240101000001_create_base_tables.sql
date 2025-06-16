-- ===== ユーザー関連テーブル =====
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- リフレッシュトークン
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- ===== ドキュメント関連テーブル（CRDT対応） =====
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'document' CHECK (type IN ('document', 'folder')),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- CRDT関連
    crdt_state BYTEA, -- CRDT document state
    version BIGINT DEFAULT 0,
    
    -- メタデータ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_edited_by UUID REFERENCES users(id),
    last_edited_at TIMESTAMPTZ
);

CREATE INDEX idx_documents_owner_id ON documents(owner_id);
CREATE INDEX idx_documents_type ON documents(type);

-- ドキュメントツリー構造（Closure Table Pattern）
CREATE TABLE document_tree (
    ancestor_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    descendant_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    depth INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX idx_document_tree_descendant ON document_tree(descendant_id);

-- ドキュメントのファイルシステムパス（.mdファイル保存用）
CREATE TABLE document_paths (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRDT更新履歴
CREATE TABLE document_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    update_data BYTEA NOT NULL,
    client_id TEXT NOT NULL,
    version BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_updates_document_version ON document_updates(document_id, version);
CREATE INDEX idx_document_updates_created_at ON document_updates(created_at);

-- アウェアネス（カーソル位置、選択範囲など）
CREATE TABLE document_awareness (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    cursor_position JSONB,
    selection_range JSONB,
    user_color TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (document_id, user_id, client_id)
);

CREATE INDEX idx_document_awareness_active ON document_awareness(document_id, is_active);

-- ===== 権限管理テーブル =====
CREATE TABLE document_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL CHECK (permission IN ('view', 'comment', 'edit', 'admin')),
    granted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, user_id)
);

CREATE INDEX idx_document_permissions_user ON document_permissions(user_id);
CREATE INDEX idx_document_permissions_document ON document_permissions(document_id);

-- ===== 共有リンクテーブル =====
CREATE TABLE share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    permission TEXT NOT NULL CHECK (permission IN ('view', 'comment', 'edit')),
    created_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_share_links_token ON share_links(token);
CREATE INDEX idx_share_links_document ON share_links(document_id);

-- ===== ファイル添付テーブル =====
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_document ON attachments(document_id);
CREATE INDEX idx_attachments_uploaded_by ON attachments(uploaded_by);

-- ===== ヘルパー関数 =====

-- ドキュメントツリーにノードを追加
CREATE OR REPLACE FUNCTION add_document_to_tree(
    p_document_id UUID,
    p_parent_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- 自己参照を追加
    INSERT INTO document_tree (ancestor_id, descendant_id, depth)
    VALUES (p_document_id, p_document_id, 0);
    
    -- 親が指定されている場合、親の全ての祖先との関係を追加
    IF p_parent_id IS NOT NULL THEN
        INSERT INTO document_tree (ancestor_id, descendant_id, depth)
        SELECT ancestor_id, p_document_id, depth + 1
        FROM document_tree
        WHERE descendant_id = p_parent_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ドキュメントの完全パスを取得
CREATE OR REPLACE FUNCTION get_document_path(p_document_id UUID) 
RETURNS TEXT AS $$
DECLARE
    path_parts TEXT[];
    current_id UUID;
    doc_record RECORD;
BEGIN
    -- ルートから現在のドキュメントまでのパスを構築
    WITH RECURSIVE path_cte AS (
        SELECT d.id, d.title, dt.depth
        FROM documents d
        JOIN document_tree dt ON d.id = dt.descendant_id
        WHERE dt.descendant_id = p_document_id
        AND dt.ancestor_id != dt.descendant_id
        ORDER BY dt.depth DESC
        LIMIT 1
    )
    SELECT array_agg(title ORDER BY depth DESC) INTO path_parts
    FROM path_cte;
    
    -- 現在のドキュメントのタイトルを追加
    SELECT title INTO doc_record FROM documents WHERE id = p_document_id;
    path_parts := array_append(path_parts, doc_record.title);
    
    RETURN array_to_string(path_parts, '/');
END;
$$ LANGUAGE plpgsql;

-- updated_atを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();