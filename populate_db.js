const db = process.env.NODE_ENV === 'test' ? require('./server/db_sqlite') : require('./server/db');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function populate() {
    await db.initDb();

    // Cleanup first to avoid duplicates in test
    await db.query("DELETE FROM users WHERE email = $1", ['test@example.com']);

    // Create a test user
    const hashedPw = await bcrypt.hash('password123', 10);
    const userRes = await db.query(
        "INSERT INTO users (email, password, full_name, avatar, plan) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        ['test@example.com', hashedPw, 'Minh Tuấn', 'https://lh3.googleusercontent.com/aida-public/AB6AXuApiVybfes8Xums_oQ64FbbLBUPS368do7skYSxQA1oFqch3sQsjjVxFFiGGvSYUhK1crAfD1gPIo6YKAmTnIWYyi_ul9sj_vRI1tlbJZeGTcW6s1eMX0VlVGRxlTdk_oZAQ80l3E10R0-mkulwRKPwateDhvgNFIdQBHxVVxNEWAAvZ4ZCMCEOhBTCQLkMmyG78Xa_BebodSTzquDyUxpxnjjs8okGpNAv2VIL-UPl9dU--u67P2JuNYSSPXllZwS36AHficRG8k4J', 'Premium Plan']
    );
    const userId = userRes.rows[0].id;
    console.log(`Created user ${userId}`);

    // Create categories
    await db.query("INSERT INTO categories (user_id, name) VALUES ($1, $2)", [userId, 'Tài liệu nghiên cứu AI']);
    await db.query("INSERT INTO categories (user_id, name) VALUES ($1, $2)", [userId, 'Dự án Alpha']);

    // Create notebooks
    const nbRes = await db.query(
        "INSERT INTO notebooks (user_id, name, description, icon, color) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [userId, 'Ý tưởng Khởi nghiệp 2024', 'Tập hợp các nghiên cứu thị trường, mô hình kinh doanh và chiến lược tiếp thị cho các dự án AI SaaS.', '💡', '#f97316']
    );
    const nbId = nbRes.rows[0].id;

    await db.query(
        "INSERT INTO notebooks (user_id, name, description, icon, color) VALUES ($1, $2, $3, $4, $5)",
        [userId, 'Khóa học Machine Learning', 'Tài liệu học tập, thuật toán Linear Regression, Neural Networks và Deep Learning cơ bản.', '📚', '#3b82f6']
    );

    // Create sources
    const s1 = await db.query(
        "INSERT INTO sources (user_id, name, type, content) VALUES ($1, $2, $3, $4) RETURNING id",
        [userId, 'Báo cáo Xu hướng AI 2024.pdf', 'pdf', 'Trong năm 2024, chúng ta đang chứng kiến một bước ngoặt lịch sử trong lĩnh vực trí tuệ nhân tạo...']
    );
    const s1Id = s1.rows[0].id;

    const s2 = await db.query(
        "INSERT INTO sources (user_id, name, type, content) VALUES ($1, $2, $3, $4) RETURNING id",
        [userId, 'Ghi chú cuộc họp định hướng.note', 'note', 'Cần lưu ý về việc bảo mật dữ liệu bệnh nhân khi sử dụng AI...']
    );
    const s2Id = s2.rows[0].id;

    // Link sources to notebook
    await db.query("INSERT INTO notebook_sources (notebook_id, source_id) VALUES ($1, $2)", [nbId, s1Id]);
    await db.query("INSERT INTO notebook_sources (notebook_id, source_id) VALUES ($1, $2)", [nbId, s2Id]);

    // Create notes
    await db.query(
        "INSERT INTO notes (notebook_id, user_id, title, content) VALUES ($1, $2, $3, $4)",
        [nbId, userId, 'Tương lai của Trí tuệ Nhân tạo', 'Hệ thống quản lý kiến thức cá nhân (PKM) đang trải qua một cuộc cách mạng...']
    );

    // Create trash
    const ts1 = await db.query(
        "INSERT INTO sources (user_id, name, type, is_deleted) VALUES ($1, $2, $3, $4) RETURNING id",
        [userId, 'Tài liệu nghiên cứu AI.pdf', 'pdf', 1]
    );
    await db.query(
        "INSERT INTO trash (user_id, item_id, item_type, item_name, expires_at) VALUES ($1, $2, $3, $4, $5)",
        [userId, ts1.rows[0].id, 'source', 'Tài liệu nghiên cứu AI.pdf', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
    );

    // Create notifications
    await db.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)",
        [userId, 'AI đã hoàn thành phân tích Báo cáo Q4', 'Phân tích chuyên sâu về tăng trưởng và rủi ro đã sẵn sàng trong thư mục dự án.', 'info']
    );

    // Create sessions
    await db.query(
        "INSERT INTO sessions (user_id, device_name, location) VALUES ($1, $2, $3)",
        [userId, 'MacBook Pro 14"', 'TP. Hồ Chí Minh, Việt Nam']
    );
    await db.query(
        "INSERT INTO sessions (user_id, device_name, location) VALUES ($1, $2, $3)",
        [userId, 'iPhone 15 Pro', 'Hà Nội, Việt Nam']
    );

    console.log("Database populated.");
    process.exit(0);
}

populate().catch(err => {
    console.error(err);
    process.exit(1);
});
