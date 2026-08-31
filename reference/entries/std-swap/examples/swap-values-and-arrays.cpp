#include <iostream>
#include <utility>

int main() {
    int left = 1;
    int right = 2;
    std::swap(left, right);

    int first[3]{1, 2, 3};
    int second[3]{4, 5, 6};
    std::swap(first, second);

    std::cout << "left=" << left << " right=" << right << '\n';
    std::cout << "a=" << first[0] << ',' << first[1] << ',' << first[2]
              << " b=" << second[0] << ',' << second[1] << ',' << second[2]
              << '\n';
}
