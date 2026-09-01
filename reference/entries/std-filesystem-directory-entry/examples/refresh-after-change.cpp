#include <filesystem>
#include <fstream>
#include <iostream>
#include <system_error>

namespace fs = std::filesystem;

struct Cleanup {
    fs::path root;
    ~Cleanup() noexcept {
        try {
            std::error_code ignored;
            fs::remove_all(root, ignored);
        } catch (...) {
        }
    }
};

int fail(int code) {
    std::cerr << "filesystem example failed\n";
    return code;
}

int main() {
    const fs::path root{"batch10-entry-refresh"};
    std::error_code ec;
    fs::remove_all(root, ec);
    if (ec) return fail(1);
    Cleanup cleanup{root};
    if (!fs::create_directories(root, ec) || ec) return fail(2);

    const fs::path file = root / "note.txt";
    {
        std::ofstream output{file};
        if (!output) return fail(3);
        output << 'a';
        output.close();
        if (!output) return fail(4);
    }

    fs::directory_entry entry{file, ec};
    if (ec) return fail(5);
    const auto before = entry.file_size(ec);
    if (ec) return fail(6);
    {
        std::ofstream output{file, std::ios::app};
        if (!output) return fail(7);
        output << 'b';
        output.close();
        if (!output) return fail(8);
    }
    entry.refresh(ec);
    if (ec) return fail(9);
    const auto after = entry.file_size(ec);
    if (ec) return fail(10);

    std::cout << "before=" << before << '\n';
    std::cout << "after=" << after << '\n';
}
