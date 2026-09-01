#include <filesystem>
#include <fstream>
#include <iostream>
#include <system_error>

namespace fs = std::filesystem;

struct Cleanup {
    fs::path root;
    ~Cleanup() {
        std::error_code ignored;
        fs::remove_all(root, ignored);
    }
};

int main() {
    const fs::path root{"batch10-entry-demo"};
    std::error_code ec;
    fs::remove_all(root, ec);
    if (ec || !fs::create_directories(root, ec) || ec) return 1;
    Cleanup cleanup{root};

    const fs::path file = root / "note.txt";
    std::ofstream output{file};
    if (!output) return 2;
    output << "abc";
    output.close();
    if (!output) return 3;

    fs::directory_entry entry{file, ec};
    if (ec) return 4;
    const bool regular = entry.is_regular_file(ec);
    if (ec) return 5;
    const auto bytes = entry.file_size(ec);
    if (ec) return 6;

    std::cout << "name=" << entry.path().filename().generic_string() << '\n';
    std::cout << std::boolalpha << "regular=" << regular << '\n';
    std::cout << "bytes=" << bytes << '\n';
}
