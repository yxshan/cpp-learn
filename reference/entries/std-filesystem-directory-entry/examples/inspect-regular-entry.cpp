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
    const fs::path root{"batch10-entry-demo"};
    std::error_code ec;
    fs::remove_all(root, ec);
    if (ec) return fail(1);
    Cleanup cleanup{root};
    if (!fs::create_directories(root, ec) || ec) return fail(2);

    const fs::path file = root / "note.txt";
    std::ofstream output{file};
    if (!output) return fail(3);
    output << "abc";
    output.close();
    if (!output) return fail(4);

    fs::directory_entry entry{file, ec};
    if (ec) return fail(5);
    const bool regular = entry.is_regular_file(ec);
    if (ec) return fail(6);
    const auto bytes = entry.file_size(ec);
    if (ec) return fail(7);

    std::cout << "name=" << entry.path().filename().generic_string() << '\n';
    std::cout << std::boolalpha << "regular=" << regular << '\n';
    std::cout << "bytes=" << bytes << '\n';
}
