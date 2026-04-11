-- ============================================
-- 初始数据 Seed
-- ============================================

-- 初始标签
INSERT INTO tags (name, slug) VALUES 
('JavaScript', 'javascript'),
('TypeScript', 'typescript'),
('Python', 'python'),
('React', 'react'),
('Vue', 'vue'),
('Node.js', 'nodejs'),
('Docker', 'docker'),
('Git', 'git');

-- 初始分类
INSERT INTO categories (name, slug, parent_id) VALUES 
('前端开发', 'frontend', 0),
('后端开发', 'backend', 0),
('DevOps', 'devops', 0),
('React', 'react', 1),
('Vue', 'vue', 1),
('Node.js', 'nodejs', 2);