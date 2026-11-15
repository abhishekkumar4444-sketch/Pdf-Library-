const SUPABASE_URL =
"https://icdllizxzfhixbfnodvh.supabase.co";

const SUPABASE_ANON_KEY =
"sb_publishable_DQtjYzuwGPSmtaaRhUosDw_RtPYbpi3";

const db = window.supabase.createClient(
  https://icdllizxzfhixbfnodvh.supabase.co,
    sb_publishable_DQtjYzuwGPSmtaaRhUosDw_RtPYbpi3
);

const bookGrid = document.getElementById("bookGrid");
const searchInput = document.getElementById("searchInput");
const classFilter = document.getElementById("classFilter");
const subjectFilter = document.getElementById("subjectFilter");
const bookCount = document.getElementById("bookCount");

let books = [];

// Load published books
async function loadBooks() {
    bookGrid.innerHTML =
        '<p class="empty-message">Loading PDFs...</p>';

    const { data, error } = await db
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        bookGrid.innerHTML =
            '<p class="empty-message">Unable to load library.</p>';
        console.error(error);
        return;
    }

    books = data || [];
    displayBooks();
}

// Display books
function displayBooks() {
    const search = searchInput.value.toLowerCase().trim();
    const selectedClass = classFilter.value;
    const selectedSubject = subjectFilter.value;

    const filtered = books.filter(book => {
        const text = [
            book.title,
            book.chapter,
            book.subject,
            book.class_name
        ].join(" ").toLowerCase();

        return (
            text.includes(search) &&
            (!selectedClass ||
                book.class_name === selectedClass) &&
            (!selectedSubject ||
                book.subject === selectedSubject)
        );
    });

    bookCount.textContent = filtered.length + " PDFs";

    if (!filtered.length) {
        bookGrid.innerHTML =
            '<p class="empty-message">No PDFs found. Try another search.</p>';
        return;
    }

    bookGrid.innerHTML = filtered.map(book => {
        const safeTitle = escapeHTML(book.title);
        const safeChapter = escapeHTML(book.chapter);
        const safeClass = escapeHTML(book.class_name);
        const safeSubject = escapeHTML(book.subject);

        const { data } = db.storage
            .from("library-pdfs")
            .getPublicUrl(book.file_path);

        const url = data.publicUrl;

        return `
            <article class="book-card">
                <div class="pdf-icon">📕</div>
                <h3>${safeTitle}</h3>
                <p>📚 ${safeClass}</p>
                <p>📖 ${safeSubject}</p>
                <p>Chapter: ${safeChapter}</p>
                <a class="download-btn"
                   href="${escapeHTML(url)}"
                   target="_blank"
                   rel="noopener noreferrer"
                   download>
                   ↓ Download PDF
                </a>
            </article>
        `;
    }).join("");
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Search and filters
searchInput.addEventListener("input", displayBooks);
classFilter.addEventListener("change", displayBooks);
subjectFilter.addEventListener("change", displayBooks);

// Visitor PDF submission
const uploadForm = document.getElementById("uploadForm");
const uploadStatus = document.getElementById("uploadStatus");

uploadForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const file = document.getElementById("pdfFile").files[0];

    const title = document.getElementById("bookTitle").value.trim();
    const className = document.getElementById("uploadClass").value;
    const subject = document.getElementById("uploadSubject").value;
    const chapter = document.getElementById("chapterName").value.trim();
    const uploader = document.getElementById("uploaderName").value.trim();

    if (!file || !title || !className || !subject || !chapter) {
        uploadStatus.textContent = "Please complete all required fields.";
        return;
    }

    if (file.type !== "application/pdf" ||
        !file.name.toLowerCase().endsWith(".pdf")) {
        uploadStatus.textContent = "Only PDF files are allowed.";
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        uploadStatus.textContent = "PDF must be under 20 MB.";
        return;
    }

    const consent = confirm(
        "Confirm that you have permission to share this PDF."
    );

    if (!consent) return;

    const submitButton = uploadForm.querySelector("button");
    submitButton.disabled = true;
    submitButton.textContent = "Uploading...";
    uploadStatus.textContent = "Please wait...";

    const filePath =
        crypto.randomUUID() + ".pdf";

    try {
        // Upload to private pending storage
        const { error: uploadError } = await db.storage
            .from("pending-pdfs")
            .upload(filePath, file, {
                contentType: "application/pdf",
                upsert: false
            });

        if (uploadError) throw uploadError;

        // Save submission details
        const { error: insertError } = await db
            .from("submissions")
            .insert({
                title: title,
                class_name: className,
                subject: subject,
                chapter: chapter,
                uploader_name: uploader || null,
                file_path: filePath,
                status: "pending"
            });

        if (insertError) {
            // Remove uploaded file if database insertion fails
            await db.storage
                .from("pending-pdfs")
                .remove([filePath]);

            throw insertError;
        }

        uploadStatus.textContent =
            "PDF submitted successfully! Waiting for admin approval.";

        uploadForm.reset();

    } catch (error) {
        console.error(error);

        uploadStatus.textContent =
            "Upload failed. Please try again later.";
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit PDF";
    }
});

// Start application
loadBooks();
