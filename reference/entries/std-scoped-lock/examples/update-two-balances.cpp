#include <functional>
#include <iostream>
#include <mutex>
#include <thread>

struct Account {
  explicit Account(int initial_balance) : balance(initial_balance) {}

  int balance;
  std::mutex mutex;
};

void transfer(Account& from, Account& to, int amount) {
  std::scoped_lock lock(from.mutex, to.mutex);
  from.balance -= amount;
  to.balance += amount;
}

int main() {
  Account left{1000};
  Account right{1000};

  std::thread first(transfer, std::ref(left), std::ref(right), 200);
  std::thread second(transfer, std::ref(right), std::ref(left), 200);
  first.join();
  second.join();

  std::cout << "left=" << left.balance << '\n';
  std::cout << "right=" << right.balance << '\n';
  std::cout << "total=" << left.balance + right.balance << '\n';
}
